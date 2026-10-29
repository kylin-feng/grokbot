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

  // Task-specific activity streams — same kind of task always runs the same
  // sequence on the Bot's computer, like the real product.
  var STEP_PLANS = [
    { re: /inbox|e-?mail|gmail|reply|replies|draft|unread/i,
      steps: ['Opening Gmail…', 'Reading unread…', 'Triaging the queue…', 'Drafting replies…', 'Parking what needs you…', 'Marking the rest done…', 'Wrapping up…'] },
    { re: /candidate|recruit|hir|talent|sourcing|pipeline|cv|r[eé]sum[eé]/i,
      steps: ['Opening LinkedIn…', 'Searching candidates…', 'Reading profiles…', 'Scoring fit…', 'Updating the pipeline sheet…', 'Writing the shortlist…', 'Wrapping up…'] },
    { re: /expense|receipt|reconcil|invoice|budget|spend|card statement/i,
      steps: ['Opening Sheets…', 'Pulling transactions…', 'Matching receipts…', 'Flagging anomalies…', 'Updating the ledger…', 'Double-checking totals…', 'Wrapping up…'] },
    { re: /calendar|schedule|meeting|book|agenda|plan my|line up/i,
      steps: ['Opening Calendar…', 'Reading the week…', 'Checking conflicts…', 'Protecting focus time…', 'Drafting the agenda…', 'Sending invites…', 'Wrapping up…'] },
    { re: /research|look up|compare|summar|market|competitor|news|pricing|scrape/i,
      steps: ['Opening browser…', 'Searching the web…', 'Reading sources…', 'Cross-checking claims…', 'Pulling numbers…', 'Writing the brief…', 'Wrapping up…'] },
    { re: /\bpost\b|tweet|\bx\b|twitter|social|thread|content/i,
      steps: ['Opening X…', 'Reading the timeline…', 'Finding the angle…', 'Drafting the post…', 'Saving to drafts…', 'Wrapping up…'] },
    { re: /support|ticket|zendesk|queue|customer|churn|refund/i,
      steps: ['Opening Zendesk…', 'Reading the queue…', 'Answering the easy ones…', 'Escalating the tricky ones…', 'Updating statuses…', 'Wrapping up…'] }
  ];
  var DEFAULT_STEPS = ['Opening browser…', 'Gathering context…', 'Reading the queue…', 'Cross-checking details…', 'Pulling the numbers…', 'Drafting the update…', 'Double-checking results…', 'Wrapping up…'];
  function stepsFor(task) {
    for (var i = 0; i < STEP_PLANS.length; i++) if (STEP_PLANS[i].re.test(task)) return STEP_PLANS[i].steps.slice();
    return DEFAULT_STEPS.slice();
  }

  // Apps the Bot may need to be signed into before it can work — mirrors the
  // real product's mid-task "Sign in to X so I can Y" check-ins.
  var APP_HINTS = [
    { re: /gmail|google mail|\binbox\b|\be-?mails?\b|\bmail\b/i, app: 'Gmail' },
    { re: /zendesk|\btickets?\b|support queue/i, app: 'Zendesk' },
    { re: /\bx\.com|twitter|tweet/i, app: 'X' },
    { re: /sheets?|spreadsheet|excel/i, app: 'Google Sheets' },
    { re: /calendar|invite|agenda/i, app: 'Google Calendar' },
    { re: /slack/i, app: 'Slack' },
    { re: /notion/i, app: 'Notion' },
    { re: /linkedin/i, app: 'LinkedIn' }
  ];
  function appNeeded(task, bot) {
    for (var i = 0; i < APP_HINTS.length; i++) {
      var a = APP_HINTS[i];
      if (a.re.test(task) && !(bot.connected && bot.connected[a.app])) return a.app;
    }
    return null;
  }

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
  var pending = null;   // the task currently running on screen (steps + sign-in state)
  var uiState = 'idle'; // idle | working | waiting
  var simToken = 0;     // bumped whenever the screen view is reset for a new task

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
    // per-instance blink delay so every Bot's eyes blink on its own rhythm
    var d1 = (Math.random() * 4.5).toFixed(2), d2 = (Math.random() * 4.5).toFixed(2);
    return '<span class="blob ' + (cls || '') + '" style="background:' + color +
      ';--bd1:' + d1 + 's;--bd2:' + d2 + 's"></span>';
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
    chip.className = 'status-chip ' + (uiState === 'working' ? 'working' : uiState === 'waiting' ? 'waiting' : 'idle');
    chip.textContent = uiState === 'working' ? 'Working' : uiState === 'waiting' ? 'Waiting' : 'Idle';

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
      if (m.role === 'caption') {
        html += '<div class="sys-caption">' + esc(m.content) + '</div>';
        return;
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
        var byLine = (m.by && m.by !== bot.name) ? '<div class="bot-by">' + esc(m.by) + '</div>' : '';
        var body;
        if (m.error) {
          body = '<div class="msg-error">' + esc(m.error) + '</div>';
        } else if (m.checkin) {
          body = '<div class="ai-content"><p>' + esc(m.content) + '</p></div>' +
            '<div class="signin-row">' + (m.connected
              ? '<span class="connected-tag">' + ICONS.check + ' Connected to ' + esc(m.checkin) + ' (demo)</span>'
              : '<button class="btn solid" data-act="connect">Open sign-in · ' + esc(m.checkin) + '</button>') +
            '</div>';
        } else {
          body = '<div class="ai-content">' + (m.content ? MD.render(m.content) : '') + '</div>';
        }
        html += '<div class="msg bot-msg" data-idx="' + i + '">' + blobHtml(m.color || bot.color) +
          '<div class="bot-card">' + byLine + body + '</div></div>' +
          '<div class="msg-actions">' +
            '<button class="act" data-act="copy" title="Copy">' + ICONS.copy + '</button>' +
            (isLast && !m.checkin ? '<button class="act" data-act="regen" title="Run again">' + ICONS.refresh + '</button>' : '') +
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
    var connBtn = e.target.closest('[data-act="connect"]');
    if (connBtn) {
      var cBot = activeBot();
      var cWrap = connBtn.closest('[data-idx]');
      if (!cBot || !cWrap) return;
      var cMsg = cBot.messages[+cWrap.getAttribute('data-idx')];
      if (cMsg && cMsg.checkin && streaming && controller) { toast('The Bot is already working'); return; }
      if (cMsg && cMsg.checkin) connectApp(cBot, cMsg);
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
  var lastLineEl = null;
  function logLine(text, ok) {
    var log = $('#sp-log');
    if (!log) return;
    var empty = log.querySelector('.sp-empty');
    if (empty) { empty.remove(); lastLineEl = null; }
    var t = new Date().toTimeString().slice(0, 5);
    if (lastLineEl && !lastLineEl.classList.contains('l-final')) {
      var prevMark = lastLineEl.querySelector('.l-mark');
      if (prevMark) { prevMark.textContent = '✓'; prevMark.classList.add('l-done'); }
    }
    var div = document.createElement('div');
    div.className = 'l-row l-in' + (ok ? ' l-final' : '');
    div.innerHTML = '<span class="l-time">' + t + '</span><span class="l-mark' + (ok ? ' l-done' : '') + '">' + (ok ? '✓' : '') + '</span><span class="l-text">' + esc(text) + '</span>';
    log.appendChild(div);
    lastLineEl = div;
    while (log.children.length > 40) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  }
  function setProgress(pct) {
    var bar = $('#sp-progress');
    if (bar) bar.firstElementChild.style.width = Math.round(pct * 100) + '%';
  }
  function resetScreenLog() {
    simToken++;
    $('#sp-log').innerHTML = '<div class="sp-empty">Live view of this Bot\'s computer.<br>(Simulated in this clone — no real cloud machine.)</div>';
    lastLineEl = null;
    setProgress(0);
  }
  function setThumbBusy(on, app) {
    var thumb = $('#sp-thumb');
    if (!thumb) return;
    $('#sp-desktop').classList.toggle('hidden', on);
    $('#sp-browser').classList.toggle('hidden', !on);
    thumb.classList.toggle('busy', on);
    if (on) $('#sp-url-text').textContent = (app || 'grok').toLowerCase().replace(/[^a-z0-9.]+/g, '') + '.com';
  }
  function setWorking(on) {
    uiState = on ? 'working' : 'idle';
    var chip = $('#head-status');
    chip.className = 'status-chip ' + (on ? 'working' : 'idle');
    chip.textContent = on ? 'Working' : 'Idle';
    var ctl = $('#sp-control');
    ctl.textContent = on ? 'Working' : "You're in control";
    ctl.className = 'sp-control' + (on ? ' working' : '');
    $('#head-avatar').classList.toggle('bob', on);
    if (!on) setThumbBusy(false);
  }
  function setWaiting(app) {
    uiState = 'waiting';
    var chip = $('#head-status');
    chip.className = 'status-chip waiting';
    chip.textContent = 'Waiting';
    var ctl = $('#sp-control');
    ctl.textContent = 'Waiting for sign-in';
    ctl.className = 'sp-control waiting';
    $('#head-avatar').classList.remove('bob');
  }

  // A task runs a fixed, task-shaped sequence of steps; if an app is needed
  // and not connected, the Bot pauses mid-work and asks you to sign in.
  function startWorkSim(bot, task) {
    var steps = stepsFor(task);
    var app = appNeeded(task, bot);
    simToken++;
    var plan = { bot: bot, steps: steps, i: 0, app: app, asked: false, waiting: false, token: simToken };
    pending = plan;
    logLine('Picking up: ' + task.slice(0, 44) + (task.length > 44 ? '…' : ''));
    setThumbBusy(true, (app || 'grok').split(' ').pop());
    clearInterval(workTimer);
    workTimer = setInterval(function () {
      if (plan.waiting) return;
      if (plan.i >= plan.steps.length) { clearInterval(workTimer); workTimer = null; return; }
      if (plan.app && !plan.asked && plan.i >= 2) {
        plan.asked = true;
        plan.waiting = true;
        clearInterval(workTimer); workTimer = null;
        pauseForSignin(bot, plan);
        return;
      }
      logLine(plan.steps[plan.i++]);
      setProgress(plan.i / plan.steps.length);
    }, 1250);
  }
  function pauseForSignin(bot, plan) {
    setWaiting(plan.app);
    logLine('Needs sign-in: ' + plan.app);
    removeTyping();
    bot.messages.push({
      role: 'assistant', checkin: plan.app, color: bot.color,
      content: 'Sign in to ' + plan.app + " so I can work this. Everything else is ready — connect and I'll take it from there.",
      time: Date.now()
    });
    saveBots();
    renderChat();
    animLast();
    scrollToEnd(true);
  }
  function connectApp(bot, msg) {
    if (!msg.checkin) return;
    msg.connected = true;
    if (!bot.connected) bot.connected = {};
    bot.connected[msg.checkin] = true;
    saveBots();
    renderChat();
    animLast();
    logLine('Connected to ' + msg.checkin + '.', true);
    toast(msg.checkin + ' connected');
    if (pending && pending.bot === bot && pending.waiting) {
      pending.waiting = false;
      setWorking(true);
      setThumbBusy(true, msg.checkin);
      clearInterval(workTimer);
      workTimer = setInterval(function () {
        var plan = pending;
        if (!plan || plan.waiting) { clearInterval(workTimer); workTimer = null; return; }
        if (plan.i >= plan.steps.length) { clearInterval(workTimer); workTimer = null; return; }
        logLine(plan.steps[plan.i++]);
        setProgress(plan.i / plan.steps.length);
      }, 1250);
      runFetch(bot, bot);
    }
  }
  function stopWorkSim(done, onDone) {
    clearInterval(workTimer);
    workTimer = null;
    if (!done) { if (onDone) onDone(); return; }
    // the report may finish streaming before the computer view caught up —
    // fast-forward the remaining steps, then close the session as Done.
    var plan = pending;
    pending = null;
    var rest = plan ? plan.steps.slice(plan.i) : [];
    var doneN = 0;
    (function flush() {
      if (simToken !== plan.token) return;   // a new task took over the screen
      if (doneN < rest.length) {
        logLine(rest[doneN++]);
        setProgress((plan.i + doneN) / plan.steps.length);
        setTimeout(flush, 300);
      } else {
        setProgress(1);
        logLine('Done.', true);
        setWorking(false);
        if (onDone) onDone();
      }
    })();
  }
  function cancelWaiting() {
    if (pending) pending.waiting = false;
    streaming = false;
    setWorking(false);
    stopWorkSim(false);
    removeTyping();
    updateSendState();
    toast('Stopped — the sign-in card stays, connect anytime');
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
    if (streaming) {
      if (controller) controller.abort();
      else cancelWaiting();
      return;
    }
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
  $('#btn-attach').addEventListener('click', function () { $('#file-input').click(); });  $('#file-input').addEventListener('change', function () {
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
  // Loop in another Bot — teammate answers in the same thread, then hands back
  // -------------------------------------------------------------------------
  var loopMenu = $('#loopin-menu');
  $('#btn-loopin').addEventListener('click', function (e) {
    e.stopPropagation();
    if (loopMenu.classList.contains('hidden')) renderLoopinMenu();
    else loopMenu.classList.add('hidden');
  });
  function renderLoopinMenu() {
    var bot = activeBot();
    var others = bots.filter(function (b) { return !bot || b.id !== bot.id; });
    loopMenu.innerHTML = '<div class="li-title">Loop in a Bot</div>' + (others.length
      ? others.map(function (b) {
          return '<button class="li-row" data-id="' + b.id + '">' + blobHtml(b.color) +
            '<span class="li-body"><span class="li-name">' + esc(b.name) + '</span>' +
            '<span class="li-role">' + esc(b.role || '') + '</span></span></button>';
        }).join('')
      : '<div class="li-empty">No other Bots yet</div>');
    loopMenu.classList.remove('hidden');
  }
  loopMenu.addEventListener('click', function (e) {
    var row = e.target.closest('.li-row');
    if (!row) return;
    var other = bots.filter(function (b) { return b.id === row.getAttribute('data-id'); })[0];
    loopIn(other);
  });
  document.addEventListener('click', function (e) {
    if (!loopMenu.classList.contains('hidden') && !e.target.closest('#loopin-menu') && !e.target.closest('#btn-loopin')) {
      loopMenu.classList.add('hidden');
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') loopMenu.classList.add('hidden');
  });
  function loopIn(other) {
    loopMenu.classList.add('hidden');
    if (!other) return;
    var bot = activeBot();
    if (!bot) return;
    if (streaming) { toast('Wait for the current task to finish'); return; }
    if (!bot.messages.length || bot.messages[bot.messages.length - 1].role === 'user') {
      toast('Ask something first, then loop in a teammate');
      return;
    }
    bot.messages.push({ role: 'caption', content: 'Asking ' + other.name + '…', time: Date.now() });
    saveBots();
    renderChat();
    animLast();
    streamReply(bot, other, 'follow up on the thread above');
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
    var msgs = [];
    bot.messages.forEach(function (m) {
      if (m.role === 'user') {
        if (m.content) msgs.push({ role: 'user', content: m.content });
      } else if (m.role === 'assistant' && !m.error && m.content) {
        msgs.push({ role: 'assistant', content: (m.by ? '[' + m.by + '] ' : '') + m.content });
      }
    });
    return msgs;
  }

  function buildPayload(spk, threadBot) {
    var p = {
      model: settings.model || 'grok-4.1',
      messages: [{ role: 'system', content: systemPrompt(spk) }].concat(historyForApi(threadBot)),
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
    animLast();

    streamReply(bot);
  }

  function animLast() {
    var els = $('#thread').querySelectorAll('.msg-user-wrap, .msg.bot-msg, .sys-caption');
    var el = els[els.length - 1];
    if (el) el.classList.add('anim-in');
  }
  function appendTyping(bot) {
    var thread = $('#thread');
    var wrap = document.createElement('div');
    wrap.className = 'msg bot-msg anim-in';
    wrap.id = 'typing-row';
    wrap.innerHTML = blobHtml(bot.color) +
      '<div class="bot-card"><div class="typing"><span></span><span></span><span></span></div></div>';
    thread.appendChild(wrap);
    scrollToEnd(true);
  }
  function removeTyping() {
    var t = $('#typing-row');
    if (t) t.remove();
  }

  function streamReply(bot, speaker, taskText) {
    var spk = speaker || bot;
    var task = taskText || userText(bot.messages[bot.messages.length - 1].content) || 'new task';
    $('#app').classList.remove('no-screen');   // the computer view is the show
    $('#sp-caption').textContent = spk.name + "'s screen";
    resetScreenLog();
    streaming = true;
    controller = null;
    updateSendState();
    setWorking(true);
    appendTyping(spk);
    startWorkSim(bot, task);
    if (!pending || !pending.app) runFetch(bot, spk);
  }

  function runFetch(bot, spk) {
    var payload = buildPayload(spk, bot);
    var assistant = { role: 'assistant', content: '', time: Date.now() };
    if (spk !== bot) { assistant.by = spk.name; assistant.color = spk.color; }
    bot.messages.push(assistant);

    removeTyping();
    var thread = $('#thread');
    var wrap = document.createElement('div');
    wrap.className = 'msg bot-msg anim-in';
    wrap.innerHTML = blobHtml(spk.color) +
      '<div class="bot-card"><div class="ai-content"><div class="typing"><span></span><span></span><span></span></div></div></div>';
    thread.appendChild(wrap);
    scrollToEnd(true);

    var contentEl = wrap.querySelector('.ai-content');
    var started = false;
    var rafPending = false;
    streaming = true;
    controller = new AbortController();
    updateSendState();

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
      contentEl.classList.remove('stream-cursor');
      saveBots();
      renderChat();
      renderSidebar();
      updateSendState();
      if (!aborted && !assistant.error) {
        stopWorkSim(true, function () {   // after the screen catches up:
          if (spk !== bot) {              // hand the thread back to its owner
            bot.messages.push({ role: 'caption', content: 'Handed to ' + bot.name + '.', time: Date.now() });
            saveBots();
            renderSidebar();
            if (activeId === bot.id) { renderChat(); animLast(); }
          }
        });
      } else { setWorking(false); stopWorkSim(false); }
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
