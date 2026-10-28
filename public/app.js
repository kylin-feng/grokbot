/**
 * GrokBot — frontend application logic
 * A clone of xAI's Grok Bot: a team of always-on AI teammates you message
 * like coworkers. Each Bot is a role-persona conversation backed by the
 * xAI (or any OpenAI-compatible) API; the "Bot's screen" panel simulates
 * the cloud-computer activity view.
 */
(function () {
  'use strict';

  // -------------------------------------------------------------------------
  // Models & presets
  // -------------------------------------------------------------------------
  var MODELS = [
    { id: 'grok-4.1', name: 'Grok 4.1' },
    { id: 'grok-4.1-fast', name: 'Grok 4.1 Fast' },
    { id: 'grok-4', name: 'Grok 4' },
    { id: 'grok-4-fast', name: 'Grok 4 Fast' },
    { id: 'grok-3', name: 'Grok 3' },
    { id: 'grok-3-mini', name: 'Grok 3 Mini' },
    { id: 'grok-2-1212', name: 'Grok 2' }
  ];

  var COLORS = ['#8b5cf6', '#f97316', '#22c55e', '#3b82f6', '#ec4899', '#14b8a6', '#eab308', '#f43f5e'];

  var PRESETS = [
    {
      name: 'Chief of Staff', color: '#8b5cf6',
      role: 'keeps everything moving — plans the day, coordinates the other Bots, unblocks anything stuck',
      greeting: "Morning. Everything's on track. Want me to line up your day?"
    },
    {
      name: 'Inbox Manager', color: '#f97316',
      role: 'works the inbox to zero, drafts every reply, parks anything that needs your review',
      greeting: 'inbox at zero — 5 drafts parked for tomorrow. anything urgent?'
    },
    {
      name: 'Talent Scout', color: '#22c55e',
      role: 'sources and ranks candidates, keeps the pipeline table current',
      greeting: '3 strong candidates surfaced for the DevRel role. want the shortlist?'
    },
    {
      name: 'Expense Manager', color: '#3b82f6',
      role: 'reconciles expenses, chases receipts, flags anomalies',
      greeting: 'Q3 expenses reconciled. 2 receipts need your approval.'
    },
    {
      name: 'Account Manager', color: '#ec4899',
      role: 'checks in on every account, watches renewals and risks',
      greeting: 'checked in on all accounts — 1 renewal at risk. details?'
    }
  ];

  var NEW_BOT_GREETING = 'Hey! What do you want me around for? Anything concrete, or more of a general sidekick?';

  var WORK_STEPS = [
    'Opening browser…', 'Signing in…', 'Reading the queue…', 'Working the inbox…',
    'Cross-checking details…', 'Pulling the numbers…', 'Drafting updates…',
    'Saving files…', 'Double-checking results…', 'Wrapping up…'
  ];

  var ICONS = {
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"/></svg>',
    pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
  };

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  function load(k, d) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; }
  }
  function persist(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); }
    catch (e) { toast('Browser storage is full — state may not persist'); }
  }

  var settings = Object.assign(
    { apiKey: '', baseUrl: '', model: 'grok-4.1', theme: 'dark', temperature: '' },
    load('gb:settings', {})
  );
  var bots = load('gb:bots', null);
  if (!bots) {
    bots = PRESETS.map(function (p, i) {
      return {
        id: 'preset-' + i,
        name: p.name,
        role: p.role,
        color: p.color,
        messages: [{ role: 'assistant', content: p.greeting, time: Date.now() - (PRESETS.length - i) * 3600e3 }]
      };
    });
    persist('gb:bots', bots);
  }
  var routines = load('gb:routines', []);
  var activeId = load('gb:active', bots.length ? bots[0].id : null);
  var controller = null;
  var streaming = false;
  var attachments = [];
  var serverHasKey = false;
  var stickBottom = true;
  var workTimer = null;

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  function $(s, el) { return (el || document).querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function toast(msg, ms) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.add('hidden'); }, ms || 2600);
  }
  function activeBot() {
    for (var i = 0; i < bots.length; i++) if (bots[i].id === activeId) return bots[i];
    return null;
  }
  function saveBots() { persist('gb:bots', bots); }

  function timeShort(ts) {
    var d = new Date(ts), n = new Date();
    var sameDay = d.toDateString() === n.toDateString();
    if (sameDay) return d.toTimeString().slice(0, 5);
    var y = new Date(n.getTime() - 86400e3);
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return (d.getMonth() + 1) + '/' + d.getDate();
  }
  function dayLabel(ts) {
    var d = new Date(ts), n = new Date();
    if (d.toDateString() === n.toDateString()) return 'Today';
    var y = new Date(n.getTime() - 86400e3);
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function blobHtml(color, cls) {
    return '<span class="blob ' + (cls || '') + '" style="background:' + color + '"></span>';
  }
  function userText(content) {
    if (typeof content === 'string') return content;
    var t = [];
    (content || []).forEach(function (p) { if (p.type === 'text') t.push(p.text); });
    return t.join('\n');
  }
  function userImages(content) {
    if (!Array.isArray(content)) return [];
    return content.filter(function (p) { return p.type === 'image_url'; }).map(function (p) { return p.image_url.url; });
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () { fallbackCopy(text); });
    } else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }
  function flashCopied(btn) {
    var old = btn.innerHTML;
    btn.innerHTML = ICONS.check;
    setTimeout(function () { btn.innerHTML = old; }, 1200);
  }

  // -------------------------------------------------------------------------
  // Sidebar
  // -------------------------------------------------------------------------
  function renderSidebar() {
    var q = $('#bot-search').value.trim().toLowerCase();
    var list = bots.slice().sort(function (a, b) {
      return lastTime(b) - lastTime(a);
    });
    if (q) list = list.filter(function (b) { return b.name.toLowerCase().indexOf(q) >= 0; });

    $('#bot-list').innerHTML = list.length ? list.map(function (b) {
      var last = lastMessage(b);
      return '<button class="bot-item' + (b.id === activeId ? ' active' : '') + '" data-id="' + b.id + '">' +
        blobHtml(b.color) +
        '<span class="bi-body">' +
          '<span class="bi-name"><span class="bi-nm">' + esc(b.name) + '</span>' +
          '<span class="bi-time">' + (last ? timeShort(last.time) : '') + '</span></span>' +
          '<span class="bi-preview">' + (last ? esc(previewOf(last)) : 'New Bot') + '</span>' +
        '</span>' +
        '<span class="bi-actions">' +
          '<button data-act="ren" title="Rename">' + ICONS.pencil + '</button>' +
          '<button data-act="del" title="Delete">' + ICONS.trash + '</button>' +
        '</span></button>';
    }).join('') : '<div class="sb-empty" style="padding:10px 12px;font-size:12.5px;color:var(--text-3)">No Bots found</div>';

    var freqs = ['Daily', 'Every week', 'Every 2 weeks'];
    var html = '';
    freqs.forEach(function (f) {
      var items = routines.filter(function (r) { return r.freq === f; });
      if (!items.length) return;
      html += '<div class="sb-label">' + esc(f) + '</div>';
      items.forEach(function (r) {
        html += '<div class="routine-item" title="' + esc(r.name) + ' — ' + esc(f) + '">' +
          '<span class="ri-dot"></span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(r.name) + '</span>' +
          '<button class="ri-x" data-rid="' + r.id + '" title="Remove">' + ICONS.x + '</button></div>';
      });
    });
    $('#routine-sections').innerHTML = html;
  }

  function lastMessage(bot) {
    for (var i = bot.messages.length - 1; i >= 0; i--) return bot.messages[i];
    return null;
  }
  function lastTime(bot) {
    var m = lastMessage(bot);
    return m ? m.time : 0;
  }
  function previewOf(msg) {
    var t = userText(msg.content).replace(/\s+/g, ' ').trim();
    return t.slice(0, 46);
  }

  $('#bot-list').addEventListener('click', function (e) {
    var act = e.target.closest('[data-act]');
    var item = e.target.closest('.bot-item');
    if (!item) return;
    var id = item.getAttribute('data-id');
    var bot = null;
    for (var i = 0; i < bots.length; i++) if (bots[i].id === id) bot = bots[i];
    if (!bot) return;
    if (act) {
      e.stopPropagation();
      if (act.getAttribute('data-act') === 'del') {
        bots.splice(bots.indexOf(bot), 1);
        if (activeId === id) { activeId = bots.length ? bots[0].id : null; persist('gb:active', activeId); renderChat(); }
        saveBots(); renderSidebar();
      } else {
        var name = prompt('Rename Bot', bot.name);
        if (name && name.trim()) { bot.name = name.trim().slice(0, 40); saveBots(); renderSidebar(); renderChat(); }
      }
      return;
    }
    if (streaming) { toast('Wait for this Bot to finish (or stop it)'); return; }
    openBot(id);
    closeMobileSidebar();
  });

  $('#routine-sections').addEventListener('click', function (e) {
    var x = e.target.closest('.ri-x');
    if (!x) return;
    var rid = x.getAttribute('data-rid');
    routines = routines.filter(function (r) { return r.id !== rid; });
    persist('gb:routines', routines);
    renderSidebar();
  });

  $('#bot-search').addEventListener('input', renderSidebar);
  $('#btn-find').addEventListener('click', function () { $('#bot-search').focus(); });

  // -------------------------------------------------------------------------
  // Chat rendering
  // -------------------------------------------------------------------------
  function openBot(id) {
    activeId = id;
    persist('gb:active', activeId);
    renderChat();
    renderSidebar();
    input.placeholder = 'Message ' + (activeBot() ? activeBot().name : 'Bot');
  }

  function renderChat() {
    var bot = activeBot();
    var thread = $('#thread');

    // header
    var head = $('#head-name'), chip = $('#head-status');
    if (bot) {
      head.textContent = bot.name;
      var av = $('#head-avatar');
      av.style.background = bot.color;
      $('#sp-caption').textContent = bot.name + "'s screen";
    }
    chip.className = 'status-chip ' + (streaming ? 'working' : 'idle');
    chip.textContent = streaming ? 'Working' : 'Idle';

    if (!bot) {
      thread.innerHTML = '<div id="thread-empty">' + blobHtml('#8b5cf6') +
        '<h3>No Bots yet</h3><p>Your team of always-on AI teammates lives here. Create your first Bot and start delegating.</p>' +
        '<button class="ghost-btn" id="empty-new">New Bot</button></div>';
      $('#empty-new').addEventListener('click', function () { openBotModal(); });
      input.placeholder = 'Message…';
      return;
    }

    var html = '';
    var lastDay = '';
    bot.messages.forEach(function (m, i) {
      var day = dayLabel(m.time || Date.now());
      if (day !== lastDay) {
        lastDay = day;
        html += '<div class="day-divider">' + day + '</div>';
      }
      if (m.role === 'user') {
        var imgs = userImages(m.content).map(function (u) { return '<img src="' + esc(u) + '" alt="">'; }).join('');
        html += '<div class="msg-user-wrap" style="display:flex;flex-direction:column" data-idx="' + i + '">' +
          '<div class="msg msg-user">' + esc(userText(m.content)) + (imgs ? '<div class="u-imgs">' + imgs + '</div>' : '') + '</div>' +
          '<div class="msg-actions" style="margin:3px 0 0;align-self:flex-end">' +
            '<button class="act" data-act="ucopy" title="Copy">' + ICONS.copy + '</button>' +
            '<button class="act" data-act="uedit" title="Edit &amp; resubmit">' + ICONS.pencil + '</button>' +
          '</div></div>';
      } else {
        var isLast = i === bot.messages.length - 1 && !streaming;
        html += '<div class="msg bot-msg" data-idx="' + i + '">' + blobHtml(bot.color) +
          '<div class="bot-card">' + (m.error
            ? '<div class="msg-error">' + esc(m.error) + '</div>'
            : '<div class="ai-content">' + (m.content ? MD.render(m.content) : '') + '</div>') +
          '</div></div>' +
          '<div class="msg-actions">' +
            '<button class="act" data-act="copy" title="Copy">' + ICONS.copy + '</button>' +
            (isLast ? '<button class="act" data-act="regen" title="Run again">' + ICONS.refresh + '</button>' : '') +
          '</div>';
      }
    });
    thread.innerHTML = html;
    scrollToEnd(true);
  }

  $('#thread').addEventListener('click', function (e) {
    var cbBtn = e.target.closest('.cb-copy');
    if (cbBtn) {
      copyText(MD.getCode(+cbBtn.getAttribute('data-code')) || '');
      flashCopied(cbBtn);
      return;
    }
    var btn = e.target.closest('.act');
    if (!btn) return;
    var bot = activeBot();
    if (!bot) return;
    var wrap = btn.closest('[data-idx]');
    if (!wrap) return;
    var idx = +wrap.getAttribute('data-idx');
    var msg = bot.messages[idx];
    var act = btn.getAttribute('data-act');

    if (act === 'copy' || act === 'ucopy') {
      copyText(msg.role === 'user' ? userText(msg.content) : (msg.content || ''));
      flashCopied(btn);
    } else if (act === 'regen') {
      if (streaming) return;
      while (bot.messages.length && bot.messages[bot.messages.length - 1].role === 'assistant') bot.messages.pop();
      if (!bot.messages.length) return;
      saveBots();
      streamReply(bot);
    } else if (act === 'uedit') {
      if (streaming) { toast('Stop the Bot first'); return; }
      startEditUser(bot, idx, wrap);
    }
  });

  function startEditUser(bot, idx, wrap) {
    var msg = bot.messages[idx];
    var original = userText(msg.content);
    var bubble = wrap.querySelector('.msg-user');
    bubble.outerHTML = '<div class="msg msg-user" style="width:100%;max-width:100%"><textarea style="width:100%;min-height:60px;background:transparent;border:none;outline:none;color:inherit;font:inherit;resize:vertical">' +
      esc(original) + '</textarea></div>';
    var box = wrap.querySelector('textarea');
    box.focus();
    box.style.height = box.scrollHeight + 'px';
    function onKey(e) {
      if (e.key === 'Escape') { renderChat(); return; }
      if (e.key !== 'Enter' || e.shiftKey) return;
      e.preventDefault();
      var val = box.value.trim();
      if (!val) return;
      bot.messages[idx].content = val;
      bot.messages = bot.messages.slice(0, idx + 1);
      saveBots();
      renderChat();
      streamReply(bot);
    }
    box.addEventListener('keydown', onKey);
  }

  // -------------------------------------------------------------------------
  // Screen panel (simulated cloud computer)
  // -------------------------------------------------------------------------
  function logLine(text, ok) {
    var log = $('#sp-log');
    if (!log) return;
    var empty = log.querySelector('.sp-empty');
    if (empty) empty.remove();
    var t = new Date().toTimeString().slice(0, 5);
    var div = document.createElement('div');
    div.innerHTML = '<span class="l-time">' + t + '</span><span class="' + (ok ? 'l-ok' : '') + '">' + esc(text) + '</span>';
    log.appendChild(div);
    while (log.children.length > 40) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  }
  function resetScreenLog() {
    $('#sp-log').innerHTML = '<div class="sp-empty">Live view of this Bot\'s computer.<br>(Simulated in this clone — no real cloud machine.)</div>';
  }
  function setWorking(on) {
    var chip = $('#head-status');
    chip.className = 'status-chip ' + (on ? 'working' : 'idle');
    chip.textContent = on ? 'Working' : 'Idle';
    var ctl = $('#sp-control');
    ctl.textContent = on ? 'Working' : "You're in control";
    ctl.className = 'sp-control' + (on ? ' working' : '');
  }
  function startWorkSim(task) {
    logLine('Picking up: ' + task.slice(0, 44) + (task.length > 44 ? '…' : ''));
    var i = 0;
    clearInterval(workTimer);
    workTimer = setInterval(function () {
      if (i >= WORK_STEPS.length) { clearInterval(workTimer); return; }
      logLine(WORK_STEPS[i++]);
    }, 1300);
  }
  function stopWorkSim(done) {
    clearInterval(workTimer);
    workTimer = null;
    if (done) logLine('Done.', true);
  }

  $('#btn-screen').addEventListener('click', function () {
    $('#app').classList.toggle('no-screen');
  });

  // -------------------------------------------------------------------------
  // Composer
  // -------------------------------------------------------------------------
  var input = $('#input');
  function autoresize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 180) + 'px';
  }
  input.addEventListener('input', function () { autoresize(); updateSendState(); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      onSendClicked();
    }
  });
  $('#scroll').addEventListener('scroll', function () {
    stickBottom = this.scrollHeight - this.scrollTop - this.clientHeight < 90;
  });
  function scrollToEnd(force) {
    var sc = $('#scroll');
    if (force || stickBottom) sc.scrollTop = sc.scrollHeight;
  }
  function updateSendState() {
    var has = input.value.trim().length > 0 || attachments.length > 0;
    var btn = $('#btn-send');
    btn.disabled = streaming ? false : !has;
    btn.classList.toggle('ready', has && !streaming);
    btn.classList.toggle('streaming', streaming);
    btn.title = streaming ? 'Stop' : 'Send';
  }
  $('#btn-send').addEventListener('click', function () {
    if (streaming) { if (controller) controller.abort(); return; }
    onSendClicked();
  });
  function onSendClicked() {
    var text = input.value.trim();
    if (!text && !attachments.length) return;
    if (!settings.apiKey && !serverHasKey) {
      openSettings();
      toast('Add your xAI API key in Settings first (console.x.ai)');
      return;
    }
    var bot = activeBot() || createBot('Chief of Staff', 'keeps everything moving', COLORS[0], false);
    sendChat(bot, text);
  }

  // attachments
  $('#btn-attach').addEventListener('click', function () { $('#file-input').click(); });
  $('#file-input').addEventListener('change', function () {
    var files = Array.prototype.slice.call(this.files || []);
    files.forEach(function (f) {
      if (f.type && f.type.indexOf('image/') === 0) {
        if (f.size > 4 * 1024 * 1024) { toast('Image too large (max 4 MB)'); return; }
        var r = new FileReader();
        r.onload = function () { attachments.push({ kind: 'image', name: f.name, url: r.result }); renderAttachments(); };
        r.readAsDataURL(f);
      } else {
        if (f.size > 200 * 1024) { toast('File too large (max 200 KB)'); return; }
        var r2 = new FileReader();
        r2.onload = function () { attachments.push({ kind: 'text', name: f.name, text: String(r2.result || '') }); renderAttachments(); };
        r2.readAsText(f);
      }
    });
    this.value = '';
  });
  function renderAttachments() {
    var row = $('#attachments-row');
    row.innerHTML = attachments.map(function (a, i) {
      return '<span class="att-chip" style="display:inline-flex;align-items:center;gap:7px;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:4px 8px;font-size:12px;color:var(--text-2)">' +
        esc(a.name) + '<button data-i="' + i + '" style="border:none;background:none;color:var(--text-3);cursor:pointer;display:inline-flex">' + ICONS.x + '</button></span>';
    }).join('');
    row.querySelectorAll('button[data-i]').forEach(function (b) {
      b.addEventListener('click', function () {
        attachments.splice(+this.getAttribute('data-i'), 1);
        renderAttachments();
      });
    });
    updateSendState();
  }

  // -------------------------------------------------------------------------
  // Chat — payload & streaming
  // -------------------------------------------------------------------------
  function systemPrompt(bot) {
    return 'You are ' + bot.name + ', one of the user\'s always-on Grok Bots — AI teammates with their ' +
      'own cloud computer. Your job: ' + (bot.role || 'help the user with whatever they need') + '. ' +
      'Reply like a concise teammate reporting work: short lines, bullet lists of what was done, clear next steps. ' +
      'You are running inside a local open-source clone WITHOUT a real cloud computer: if asked to perform real ' +
      'external work (browsing, email, apps), do not claim it is finished — instead lay out exactly what you would ' +
      'do, step by step, and produce any drafts/artifacts inline. Keep replies tight.';
  }

  function historyForApi(bot) {
    var msgs = [{ role: 'system', content: systemPrompt(bot) }];
    bot.messages.forEach(function (m) {
      if (m.role === 'user') {
        if (m.content) msgs.push({ role: 'user', content: m.content });
      } else if (!m.error && m.content) {
        msgs.push({ role: 'assistant', content: m.content });
      }
    });
    return msgs;
  }

  function buildPayload(bot) {
    var p = {
      model: settings.model || 'grok-4.1',
      messages: historyForApi(bot),
      stream: true
    };
    if (settings.temperature !== '' && settings.temperature != null && !isNaN(settings.temperature)) {
      p.temperature = Number(settings.temperature);
    }
    return p;
  }

  function postJson(url, body) {
    var headers = { 'Content-Type': 'application/json' };
    if (settings.apiKey) headers['x-api-key'] = settings.apiKey;
    return fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(Object.assign({ base_url: settings.baseUrl || undefined }, body))
    });
  }

  function extractError(text) {
    try {
      var j = JSON.parse(text);
      if (j.error && j.error.message) return j.error.message;
      if (j.error && typeof j.error === 'string') return j.error;
      if (j.message) return j.message;
    } catch (e) {}
    return text && text.slice(0, 300);
  }

  function createBot(name, role, color, greet) {
    var bot = {
      id: uid(), name: name, role: role, color: color || COLORS[bots.length % COLORS.length],
      messages: greet === false ? [] : [{ role: 'assistant', content: NEW_BOT_GREETING, time: Date.now() }]
    };
    bots.push(bot);
    saveBots();
    return bot;
  }

  function sendChat(bot, text) {
    var content = text;
    var textFiles = attachments.filter(function (a) { return a.kind === 'text'; });
    var images = attachments.filter(function (a) { return a.kind === 'image'; });
    if (textFiles.length) {
      var blocks = textFiles.map(function (a) { return '[Attached file: ' + a.name + ']\n```\n' + a.text + '\n```'; });
      content = (content ? content + '\n\n' : '') + blocks.join('\n\n');
    }
    if (images.length) {
      var parts = [];
      if (content) parts.push({ type: 'text', text: content });
      images.forEach(function (a) { parts.push({ type: 'image_url', image_url: { url: a.url } }); });
      content = parts;
    }

    bot.messages.push({ role: 'user', content: content, time: Date.now() });
    input.value = '';
    autoresize();
    attachments = [];
    renderAttachments();
    saveBots();
    renderChat();
    renderSidebar();

    streamReply(bot);
  }

  function streamReply(bot) {
    var payload = buildPayload(bot);
    var assistant = { role: 'assistant', content: '', time: Date.now() };
    bot.messages.push(assistant);

    renderChat();           // removes empty state / shows new day divider
    var thread = $('#thread');
    var wrap = document.createElement('div');
    wrap.className = 'msg bot-msg';
    wrap.innerHTML = blobHtml(bot.color) +
      '<div class="bot-card"><div class="ai-content"><span class="shimmer-word">' + esc(bot.name) + '</span></div></div>';
    thread.appendChild(wrap);
    scrollToEnd(true);

    var contentEl = wrap.querySelector('.ai-content');
    var started = false;
    var rafPending = false;
    streaming = true;
    controller = new AbortController();
    setWorking(true);
    updateSendState();
    startWorkSim(userText(bot.messages[bot.messages.length - 2].content) || 'new task');

    function paint() {
      rafPending = false;
      contentEl.innerHTML = MD.render(assistant.content);
      contentEl.classList.add('stream-cursor');
      scrollToEnd();
    }
    function schedulePaint() {
      if (!rafPending) { rafPending = true; requestAnimationFrame(paint); }
    }
    function finalize(aborted) {
      streaming = false;
      controller = null;
      setWorking(false);
      stopWorkSim(!aborted && !assistant.error);
      contentEl.classList.remove('stream-cursor');
      saveBots();
      renderChat();
      renderSidebar();
      updateSendState();
    }

    async function run() {
      var resp = await fetch('/api/chat', {
        method: 'POST',
        headers: Object.assign(
          { 'Content-Type': 'application/json' },
          settings.apiKey ? { 'x-api-key': settings.apiKey } : {}
        ),
        body: JSON.stringify(Object.assign({ base_url: settings.baseUrl || undefined }, payload)),
        signal: controller.signal
      });
      if (!resp.ok) {
        var errText = await resp.text();
        var errMsg = extractError(errText);
        if (resp.status === 400 && payload.reasoning_effort) {
          payload = { model: payload.model, messages: payload.messages, stream: true };
          resp = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.assign({ base_url: settings.baseUrl || undefined }, payload)),
            signal: controller.signal
          });
          if (!resp.ok) { errText = await resp.text(); errMsg = extractError(errText); }
        }
        if (!resp.ok) {
          assistant.error = errMsg || ('Request failed (HTTP ' + resp.status + ')');
          finalize(false);
          return;
        }
      }

      var reader = resp.body.getReader();
      var dec = new TextDecoder();
      var buf = '';
      for (;;) {
        var chunk = await reader.read();
        if (chunk.done) break;
        buf += dec.decode(chunk.value, { stream: true });
        var nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          var line = buf.slice(0, nl).replace(/\r$/, '');
          buf = buf.slice(nl + 1);
          if (!line || line.charAt(0) === ':') continue;
          if (line.indexOf('data:') !== 0) continue;
          var data = line.slice(5).trim();
          if (data === '[DONE]') { buf = ''; break; }
          var ev;
          try { ev = JSON.parse(data); } catch (e) { continue; }
          var delta = ev.choices && ev.choices[0] && ev.choices[0].delta || {};
          if (delta.content) {
            if (!started) { started = true; contentEl.innerHTML = ''; }
            assistant.content += delta.content;
            schedulePaint();
          }
        }
      }
      finalize(false);
    }

    run().catch(function (err) {
      if (controller && controller.signal.aborted) finalize(true);
      else {
        assistant.error = 'Network error: ' + (err && err.message || err);
        finalize(false);
      }
    });
  }

  // -------------------------------------------------------------------------
  // Modals — onboarding / new Bot / routine / settings
  // -------------------------------------------------------------------------
  function openBotModal(prefill) {
    $('#botmodal-title').textContent = prefill ? 'Create Primary Bot' : 'New Bot';
    $('#nb-name').value = prefill || '';
    $('#nb-role').value = '';
    $('#botmodal').classList.remove('hidden');
    setTimeout(function () { (prefill ? $('#nb-role') : $('#nb-name')).focus(); }, 50);
  }
  $('#btn-newbot').addEventListener('click', function () { openBotModal(); });
  $('#botmodal-close').addEventListener('click', function () { $('#botmodal').classList.add('hidden'); });
  $('#nb-cancel').addEventListener('click', function () { $('#botmodal').classList.add('hidden'); });
  $('#nb-save').addEventListener('click', function () {
    var name = $('#nb-name').value.trim();
    if (!name) { toast('Give your Bot a name'); return; }
    var role = $('#nb-role').value.trim();
    var bot = createBot(name, role || 'general sidekick for whatever comes up', COLORS[bots.length % COLORS.length], true);
    $('#botmodal').classList.add('hidden');
    persist('gb:onboarded', true);
    openBot(bot.id);
    toast('Bot created — it just said hi');
  });

  // onboarding (first run)
  if (!load('gb:onboarded', false)) {
    $('#onboard').classList.remove('hidden');
  }
  $('#ob-existing').addEventListener('click', function () {
    $('#onboard').classList.add('hidden');
    persist('gb:onboarded', true);
    if (bots.length) openBot(bots[0].id);
  });
  $('#ob-create').addEventListener('click', function () {
    $('#onboard').classList.add('hidden');
    persist('gb:onboarded', true);
    openBotModal('Primary Bot');
  });

  // routines
  $('#btn-routine').addEventListener('click', function () {
    if (!activeBot()) { toast('Open a Bot first'); return; }
    $('#rt-name').value = '';
    $('#routinemodal').classList.remove('hidden');
    setTimeout(function () { $('#rt-name').focus(); }, 50);
  });
  $('#routinemodal-close').addEventListener('click', function () { $('#routinemodal').classList.add('hidden'); });
  $('#rt-cancel').addEventListener('click', function () { $('#routinemodal').classList.add('hidden'); });
  $('#rt-save').addEventListener('click', function () {
    var name = $('#rt-name').value.trim();
    if (!name) { toast('Name the routine'); return; }
    var freq = $('#rt-freq').value;
    routines.push({ id: uid(), name: name, freq: freq, botId: activeId });
    persist('gb:routines', routines);
    $('#routinemodal').classList.add('hidden');
    renderSidebar();
    toast('Routine created — ' + freq.toLowerCase() + ' (simulated)');
  });

  // settings
  function openSettings() {
    $('#set-key').value = settings.apiKey;
    $('#set-base').value = settings.baseUrl;
    $('#set-model').innerHTML = MODELS.map(function (m) {
      return '<option value="' + m.id + '"' + (m.id === settings.model ? ' selected' : '') + '>' + m.name + '</option>';
    }).join('');
    $('#set-temp') && ($('#set-temp').value = settings.temperature);
    $('#test-result').textContent = '';
    $('#modal').classList.remove('hidden');
    setTimeout(function () { $('#set-key').focus(); }, 50);
  }
  function closeSettings() { $('#modal').classList.add('hidden'); }
  $('#btn-settings').addEventListener('click', openSettings);
  $('#modal-close').addEventListener('click', closeSettings);
  $('#btn-cancel').addEventListener('click', closeSettings);
  $('#modal').addEventListener('click', function (e) { if (e.target === this) closeSettings(); });
  $('#set-key-eye').addEventListener('click', function () {
    var k = $('#set-key');
    k.type = k.type === 'password' ? 'text' : 'password';
  });
  $('#btn-save').addEventListener('click', function () {
    settings.apiKey = $('#set-key').value.trim();
    settings.baseUrl = $('#set-base').value.trim();
    settings.model = $('#set-model').value;
    persist('gb:settings', settings);
    closeSettings();
    toast('Settings saved');
  });
  $('#btn-test').addEventListener('click', function () {
    var out = $('#test-result');
    out.className = '';
    out.textContent = 'Testing…';
    var headers = { 'Content-Type': 'application/json' };
    var key = $('#set-key').value.trim();
    if (key) headers['x-api-key'] = key;
    fetch('/api/test', {
      method: 'POST', headers: headers,
      body: JSON.stringify({ base_url: $('#set-base').value.trim() || undefined })
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.ok) { out.className = 'ok'; out.textContent = '✓ OK — ' + j.count + ' models visible'; }
        else { out.className = 'bad'; out.textContent = '✗ ' + (j.message || 'failed'); }
      })
      .catch(function (e) { out.className = 'bad'; out.textContent = '✗ ' + (e && e.message || e); });
  });

  // misc sidebar actions
  $('#btn-connect').addEventListener('click', function () {
    toast('Connect apps is not part of this open-source clone');
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      ['#modal', '#botmodal', '#routinemodal'].forEach(function (s) { $(s).classList.add('hidden'); });
    }
  });

  // -------------------------------------------------------------------------
  // Theme & sidebar
  // -------------------------------------------------------------------------
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', settings.theme);
    var label = $('.theme-label');
    if (label) label.textContent = settings.theme === 'dark' ? 'Light mode' : 'Dark mode';
  }
  $('#btn-theme').addEventListener('click', function () {
    settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
    persist('gb:settings', settings);
    applyTheme();
  });
  function isMobile() { return window.innerWidth <= 860; }
  function closeMobileSidebar() { $('#app').classList.remove('sb-mobile-open'); }
  $('#sb-open').addEventListener('click', function () {
    if (isMobile()) $('#app').classList.add('sb-mobile-open');
    else $('#app').classList.remove('sb-collapsed');
  });
  $('#scrim').addEventListener('click', closeMobileSidebar);

  // -------------------------------------------------------------------------
  // Boot
  // -------------------------------------------------------------------------
  applyTheme();
  resetScreenLog();
  renderSidebar();
  if (activeId && activeBot()) openBot(activeId); else renderChat();
  updateSendState();
  if (window.innerWidth <= 1100) $('#app').classList.add('no-screen');
  fetch('/api/health')
    .then(function (r) { return r.json(); })
    .then(function (j) { serverHasKey = !!j.hasKey; })
    .catch(function () {});
})();
