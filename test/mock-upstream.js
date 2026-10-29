// Mock OpenAI-compatible upstream for local end-to-end tests (not part of the app)
const http = require('http');
http.createServer((req, res) => {
  if (req.url === '/v1/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ data: [{ id: 'grok-test-1' }, { id: 'grok-test-2' }] }));
  }
  if (req.url === '/v1/chat/completions') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const reply = 'On it — here is the sweep:\n\n' +
      '- **14 unread** triaged, 9 archived\n' +
      '- **5 replies drafted** and parked for your review\n' +
      '- 1 escalation to you (refund > $500)\n\n' +
      '```js\nconsole.log(42)\n```\n\n' +
      'Inbox at zero. Want the drafts sent as-is?';
    const words = reply.split(/(?<= )/);   // keep spacing, stream word by word
    let i = 0;
    const chunks = [
      { choices: [{ delta: { reasoning_content: 'Let me think... ' } }] },
      { choices: [{ delta: { reasoning_content: 'step by step.' } }] }
    ];
    words.forEach(w => chunks.push({ choices: [{ delta: { content: w } }] }));
    chunks.push({ choices: [{ delta: {} }], citations: ['https://example.com/a', 'https://example.org/b'] });
    const t = setInterval(() => {
      if (i < chunks.length) res.write('data: ' + JSON.stringify(chunks[i++]) + '\n\n');
      else { res.write('data: [DONE]\n\n'); clearInterval(t); res.end(); }
    }, 30);
    return;
  }
  if (req.url === '/v1/images/generations') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ data: [{ b64_json: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' }] }));
  }
  res.writeHead(404); res.end('{}');
}).listen(3999, () => console.log('mock upstream on 3999'));
