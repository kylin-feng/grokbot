/**
 * GrokBot — open-source Grok (grok.com) clone
 *
 * A tiny Express server that:
 *   1. serves the static frontend in /public
 *   2. proxies chat/image requests to xAI (or any OpenAI-compatible endpoint)
 *      so the API key never has to be embedded in the page (optional BYOK mode)
 */
const express = require('express');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Minimal .env loader (no extra dependency needed)
// ---------------------------------------------------------------------------
(function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || m[1].startsWith('#')) continue;
    if (process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
})();

const app = express();
const PORT = process.env.PORT || 3000;
const DEFAULT_BASE = (process.env.XAI_BASE_URL || 'https://api.x.ai/v1').replace(/\/+$/, '');
const VERSION = require('./package.json').version;

app.use(express.json({ limit: '12mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function apiKeyFrom(req) {
  const h = req.headers['x-api-key'];
  return (typeof h === 'string' && h.trim()) || process.env.XAI_API_KEY || '';
}

function baseUrlFrom(req) {
  const b = (req.body && req.body.base_url) || DEFAULT_BASE;
  return String(b).replace(/\/+$/, '');
}

/** Forward an upstream text response as-is, preserving status code. */
function relay(res, status, text, type) {
  res.status(status).type(type || 'application/json').send(text || '');
}

// ---------------------------------------------------------------------------
// GET /api/health
// ---------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({ ok: true, version: VERSION, hasKey: !!process.env.XAI_API_KEY });
});

// ---------------------------------------------------------------------------
// POST /api/chat — proxy POST {base}/chat/completions (supports SSE streaming)
// body: any OpenAI-compatible chat payload + optional `base_url` override
// auth: `x-api-key` header wins, else XAI_API_KEY from env
// ---------------------------------------------------------------------------
app.post('/api/chat', async (req, res) => {
  const key = apiKeyFrom(req);
  if (!key) {
    return res.status(401).json({
      error: { message: 'No API key configured. Set XAI_API_KEY in .env, or paste a key in Settings.' }
    });
  }
  const base = baseUrlFrom(req);
  const { base_url, ...payload } = req.body || {};

  // Abort the upstream request only when the client truly disconnects.
  // (req's 'close' fires as soon as the body is consumed — not a disconnect signal.)
  const ac = new AbortController();
  res.on('close', () => { if (!res.writableEnded) ac.abort(); });

  let upstream;
  try {
    upstream = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify(payload),
      signal: ac.signal
    });
  } catch (err) {
    if (ac.signal.aborted) return;
    return relay(res, 502, JSON.stringify({
      error: { message: 'Cannot reach ' + base + ' — ' + (err.cause && err.cause.message || err.message) }
    }));
  }

  if (!upstream.ok) {
    return relay(res, upstream.status, await upstream.text());
  }

  if (payload.stream) {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    const reader = upstream.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    } catch (err) {
      // client disconnected or upstream aborted mid-stream — nothing else to do
    }
    return res.end();
  }

  return relay(res, upstream.status, await upstream.text());
});

// ---------------------------------------------------------------------------
// POST /api/image — proxy POST {base}/images/generations
// ---------------------------------------------------------------------------
app.post('/api/image', async (req, res) => {
  const key = apiKeyFrom(req);
  if (!key) {
    return res.status(401).json({ error: { message: 'No API key configured.' } });
  }
  const base = baseUrlFrom(req);
  const { base_url, ...payload } = req.body || {};
  try {
    const upstream = await fetch(base + '/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify(payload)
    });
    return relay(res, upstream.status, await upstream.text());
  } catch (err) {
    return relay(res, 502, JSON.stringify({
      error: { message: 'Cannot reach ' + base + ' — ' + (err.cause && err.cause.message || err.message) }
    }));
  }
});

// ---------------------------------------------------------------------------
// POST /api/test — verify a key/base pair against GET {base}/models
// ---------------------------------------------------------------------------
app.post('/api/test', async (req, res) => {
  const key = apiKeyFrom(req);
  if (!key) return res.status(401).json({ ok: false, message: 'Missing API key.' });
  const base = baseUrlFrom(req);
  try {
    const r = await fetch(base + '/models', { headers: { Authorization: 'Bearer ' + key } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(r.status).json({
        ok: false,
        message: (j.error && j.error.message) || 'HTTP ' + r.status
      });
    }
    const ids = Array.isArray(j.data) ? j.data.map(m => m.id) : [];
    res.json({ ok: true, count: ids.length, sample: ids.slice(0, 10) });
  } catch (err) {
    res.status(502).json({
      ok: false,
      message: 'Cannot reach ' + base + ' — ' + (err.cause && err.cause.message || err.message)
    });
  }
});

app.listen(PORT, () => {
  console.log('');
  console.log('  GrokBot v' + VERSION);
  console.log('  ➜  http://localhost:' + PORT);
  console.log('  ➜  API key : ' + (process.env.XAI_API_KEY ? 'loaded from .env' : 'not set (enter one in the web UI)'));
  console.log('  ➜  Endpoint: ' + DEFAULT_BASE);
  console.log('');
});
