/**
 * GrokBot — frontend application logic
 * Vanilla JS, no framework, no build step.
 */
(function () {
  'use strict';

  // -------------------------------------------------------------------------
  // Models
  // -------------------------------------------------------------------------
  var MODELS = [
    { id: 'grok-4.1', name: 'Grok 4.1', desc: 'Latest flagship model' },
    { id: 'grok-4.1-fast', name: 'Grok 4.1 Fast', desc: 'Fast and efficient' },
    { id: 'grok-4', name: 'Grok 4', desc: 'Previous flagship' },
    { id: 'grok-4-fast', name: 'Grok 4 Fast', desc: 'Fast previous generation' },
    { id: 'grok-3', name: 'Grok 3', desc: 'Grok 3' },
    { id: 'grok-3-mini', name: 'Grok 3 Mini', desc: 'Lightweight reasoning' },
    { id: 'grok-2-1212', name: 'Grok 2', desc: 'Legacy' }
  ];

  var ICONS = {
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"/><path d="M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88z"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 14V2"/><path d="M9 18.12L10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88z"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"/></svg>',
    pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    chevR: '<svg class="th-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>'
  };

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  function load(k, d) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; }
  }
  var chats = load('gb:chats', []);
  var settings = Object.assign(
    { apiKey: '', baseUrl: '', model: 'grok-4.1', theme: 'dark', systemPrompt: '', temperature: '' },
    load('gb:settings', {})
  );
  var currentId = null;
  var controller = null;       // AbortController for the active stream
  var streaming = false;
  var attachments = [];        // {kind:'image'|'text', name, url?|text?}
  var modes = { think: false, deep: false, image: false };
  var serverHasKey = false;
  var stickBottom = true;

  // -------------------------------------------------------------------------
  // Tiny helpers
  // -------------------------------------------------------------------------
  function $(s, el) { return (el || document).querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function saveChats() {
    try { localStorage.setItem('gb:chats', JSON.stringify(chats)); }
    catch (e) { toast('Browser storage is full — oldest chats may not be saved'); }
  }
  function saveSettings() {
    try { localStorage.setItem('gb:settings', JSON.stringify(settings)); } catch (e) {}
  }
  function toast(msg, ms) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.add('hidden'); }, ms || 2600);
  }
  function currentChat() {
    for (var i = 0; i < chats.length; i++) if (chats[i].id === currentId) return chats[i];
    return null;
  }
  function nearBottom(el) {
    return el.scrollHeight - el.scrollTop - el.clientHeight < 90;
  }
  function scrollToEnd(force) {
    var sc = $('#scroll');
    if (force || stickBottom) sc.scrollTop = sc.scrollHeight;
  }

  // -------------------------------------------------------------------------
  // Sidebar — chat list
  // -------------------------------------------------------------------------
  function renderList() {
    var q = $('#chat-search').value.trim().toLowerCase();
    var list = chats.slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    if (q) list = list.filter(function (c) { return c.title.toLowerCase().indexOf(q) >= 0; });

    var el = $('#chat-list');
    if (!list.length) {
      el.innerHTML = '<div class="sb-empty">' + (q ? 'No matching chats' : 'No chats yet') + '</div>';
      return;
    }
    el.innerHTML = list.map(function (c) {
      return '<button class="chat-item' + (c.id === currentId ? ' active' : '') + '" data-id="' + c.id + '">' +
        '<span class="ci-title">' + esc(c.title) + '</span>' +
        '<span class="ci-actions">' +
          '<button data-act="ren" title="Rename">' + ICONS.pencil + '</button>' +
          '<button data-act="del" title="Delete">' + ICONS.trash + '</button>' +
        '</span></button>';
    }).join('');
  }

  $('#chat-list').addEventListener('click', function (e) {
    var act = e.target.closest('[data-act]');
    var item = e.target.closest('.chat-item');
    if (!item) return;
    var id = item.getAttribute('data-id');
    if (act) {
      e.stopPropagation();
      var chat = null;
      for (var i = 0; i < chats.length; i++) if (chats[i].id === id) chat = chats[i];
      if (!chat) return;
      if (act.getAttribute('data-act') === 'del') {
        chats.splice(chats.indexOf(chat), 1);
        if (currentId === id) { currentId = null; renderThread(); }
        saveChats(); renderList();
      } else {
        var name = prompt('Rename chat', chat.title);
        if (name && name.trim()) { chat.title = name.trim().slice(0, 80); saveChats(); renderList(); }
      }
      return;
    }
    if (streaming) { toast('Wait for the current reply to finish (or stop it)'); return; }
    currentId = id;
    renderThread();
    renderList();
    closeMobileSidebar();
  });

  $('#chat-search').addEventListener('input', renderList);

  // -------------------------------------------------------------------------
  // Thread rendering
  // -------------------------------------------------------------------------
  function userText(content) {
    if (typeof content === 'string') return content;
    var t = [];
    (content || []).forEach(function (p) { if (p.type === 'text') t.push(p.text); });
    return t.join('\n');
  }
  function userImages(content) {
    if (!Array.isArray(content)) return [];
    return content.filter(function (p) { return p.type === 'image_url'; })
      .map(function (p) { return p.image_url.url; });
  }

  function aiMessageHtml(msg, idx, isLast) {
    var html = '<div class="msg-ai-wrap" data-idx="' + idx + '">';

    if (msg.reasoning) {
      var secs = msg.thinkSecs ? 'Thought for ' + msg.thinkSecs + 's' : 'Thought process';
      html += '<details class="think"' + (msg.thinkLive ? ' open' : '') + '>' +
        '<summary>' + ICONS.chevR + '<span class="th-label">' + esc(secs) + '</span></summary>' +
        '<div class="think-body">' + esc(msg.reasoning) + '</div></details>';
    }

    if (msg.error) {
      html += '<div class="msg-error">' + esc(msg.error) + '</div>';
    } else if (msg.image) {
      html += '<div class="ai-image"><img src="' + esc(msg.image) + '" alt="generated image">' +
        (msg.image.match(/^https?:/) ? '<a href="' + esc(msg.image) + '" target="_blank" rel="noopener">Open original ↗</a>' : '') +
        '</div>';
      if (msg.content) html += '<div class="ai-content">' + MD.render(msg.content) + '</div>';
    } else {
      html += '<div class="ai-content">' + (msg.content ? MD.render(msg.content) : '') + '</div>';
    }

    if (msg.citations && msg.citations.length) {
      html += sourcesHtml(msg.citations);
    }

    if (!msg.pending) {
      html += '<div class="ai-actions">' +
        '<button class="act" data-act="copy" title="Copy">' + ICONS.copy + '</button>' +
        '<button class="act" data-act="up" title="Good response">' + ICONS.up + '</button>' +
        '<button class="act" data-act="down" title="Bad response">' + ICONS.down + '</button>' +
        (isLast ? '<button class="act" data-act="regen" title="Regenerate">' + ICONS.refresh + '</button>' : '') +
        '</div>';
    }
    html += '</div>';
    return html;
  }

  function sourcesHtml(citations) {
    var seen = {}, items = [];
    citations.forEach(function (c, i) {
      var url = typeof c === 'string' ? c : (c && c.url) || '';
      if (!url || seen[url]) return;
      seen[url] = true;
      var host = url.replace(/^https?:\/\//, '').split('/')[0];
      items.push('<li><a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(host) + '</a></li>');
    });
    if (!items.length) return '';
    return '<div class="sources"><div class="src-title">Sources</div><ol>' + items.join('') + '</ol></div>';
  }

  function renderThread() {
    var chat = currentChat();
    var thread = $('#thread');
    if (!chat || !chat.messages.length) {
      thread.innerHTML = '<div id="empty-state"><h1>How can I help you today?</h1></div>';
      return;
    }
    var html = chat.messages.map(function (m, i) {
      if (m.role === 'user') {
        var imgs = userImages(m.content).map(function (u) {
          return '<img src="' + esc(u) + '" alt="">';
        }).join('');
        return '<div class="msg-user-wrap" style="display:flex;flex-direction:column" data-idx="' + i + '">' +
          '<div class="msg msg-user">' + esc(userText(m.content)) +
          (imgs ? '<div class="u-imgs">' + imgs + '</div>' : '') + '</div>' +
          '<div class="user-actions">' +
            '<button class="act" data-act="ucopy" title="Copy">' + ICONS.copy + '</button>' +
            '<button class="act" data-act="uedit" title="Edit &amp; resubmit">' + ICONS.pencil + '</button>' +
          '</div></div>';
      }
      var isLast = i === chat.messages.length - 1 && !streaming;
      return '<div class="msg">' + aiMessageHtml(m, i, isLast) + '</div>';
    }).join('');
    thread.innerHTML = html;
    scrollToEnd(true);
  }

  // message-level action delegation (copy / regen / vote / edit)
  $('#thread').addEventListener('click', function (e) {
    var btn = e.target.closest('.act, .cb-copy');
    if (!btn) return;
    var chat = currentChat();
    if (!chat) return;

    if (btn.classList.contains('cb-copy')) {
      var code = MD.getCode(+btn.getAttribute('data-code'));
      copyText(code || '');
      flashCopied(btn);
      return;
    }

    var wrap = btn.closest('[data-idx]');
    if (!wrap) return;
    var idx = +wrap.getAttribute('data-idx');
    var msg = chat.messages[idx];
    var act = btn.getAttribute('data-act');

    if (act === 'copy' || act === 'ucopy') {
      copyText(userTextOrContent(msg));
      flashCopied(btn);
    } else if (act === 'up' || act === 'down') {
      chat.messages.forEach(function (m, i) {
        if (m.rating === act && i === idx) return;
      });
      msg.rating = msg.rating === act ? undefined : act;
      btn.classList.toggle('on', msg.rating === act);
    } else if (act === 'regen') {
      if (streaming) return;
      // drop trailing assistant messages, then stream again
      while (chat.messages.length && chat.messages[chat.messages.length - 1].role === 'assistant') {
        chat.messages.pop();
      }
      if (!chat.messages.length) return;
      saveChats();
      streamReply(chat);
    } else if (act === 'uedit') {
      if (streaming) { toast('Stop the current reply first'); return; }
      startEditUser(chat, idx, wrap);
    }
  });

  function userTextOrContent(msg) {
    return msg.role === 'user' ? userText(msg.content) : (msg.content || '');
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () { fallbackCopy(text); });
    } else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }
  function flashCopied(btn) {
    var old = btn.innerHTML;
    btn.innerHTML = ICONS.check;
    setTimeout(function () { btn.innerHTML = old; }, 1200);
  }

  function startEditUser(chat, idx, wrap) {
    var msg = chat.messages[idx];
    var bubble = wrap.querySelector('.msg-user');
    var original = userText(msg.content);
    bubble.outerHTML = '<div class="msg msg-user edit-box"><textarea>' + esc(original) + '</textarea>' +
      '<div class="edit-actions"><button class="btn ghost" data-ea="cancel">Cancel</button>' +
      '<button class="btn solid" data-ea="save">Save &amp; submit</button></div></div>';
    var box = wrap.querySelector('.edit-box textarea');
    box.focus();
    box.style.height = box.scrollHeight + 'px';

    wrap.addEventListener('click', function stop(e) {
      var b = e.target.closest('[data-ea]');
      if (!b) return;
      wrap.removeEventListener('click', stop);
      if (b.getAttribute('data-ea') === 'cancel') {
        renderThread();
        return;
      }
      var val = box.value.trim();
      if (!val) return;
      chat.messages[idx].content = val;
      chat.messages = chat.messages.slice(0, idx + 1);
      saveChats();
      renderThread();
      streamReply(chat);
    });
  }

  // -------------------------------------------------------------------------
  // Composer
  // -------------------------------------------------------------------------
  var input = $('#input');

  function autoresize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 220) + 'px';
  }
  input.addEventListener('input', function () { autoresize(); updateSendState(); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      onSendClicked();
    }
  });

  $('#scroll').addEventListener('scroll', function () {
    stickBottom = nearBottom(this);
  });

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
    if (modes.image) { sendImage(text); return; }
    sendChat(text);
  }

  // pills
  function bindPill(id, key) {
    $(id).addEventListener('click', function () {
      modes[key] = !modes[key];
      this.classList.toggle('on', modes[key]);
      if (key === 'image' && modes.image) {
        input.placeholder = 'Create an image…';
      } else if (key === 'image') {
        input.placeholder = 'Ask Grok anything…';
      }
    });
  }
  bindPill('#btn-think', 'think');
  bindPill('#btn-deep', 'deep');
  bindPill('#btn-img', 'image');

  // attachments
  $('#btn-attach').addEventListener('click', function () { $('#file-input').click(); });
  $('#file-input').addEventListener('change', function () {
    var files = Array.prototype.slice.call(this.files || []);
    files.forEach(function (f) {
      if (f.type && f.type.indexOf('image/') === 0) {
        if (f.size > 4 * 1024 * 1024) { toast('Image too large (max 4 MB): ' + f.name); return; }
        var r = new FileReader();
        r.onload = function () {
          attachments.push({ kind: 'image', name: f.name, url: r.result });
          renderAttachments();
        };
        r.readAsDataURL(f);
      } else {
        if (f.size > 200 * 1024) { toast('File too large (max 200 KB): ' + f.name); return; }
        var r2 = new FileReader();
        r2.onload = function () {
          attachments.push({ kind: 'text', name: f.name, text: String(r2.result || '') });
          renderAttachments();
        };
        r2.readAsText(f);
      }
    });
    this.value = '';
  });

  function renderAttachments() {
    var el = $('#attachments');
    el.classList.toggle('hidden', !attachments.length);
    el.innerHTML = attachments.map(function (a, i) {
      return '<span class="att-chip">' +
        (a.kind === 'image' ? '<img src="' + esc(a.url) + '" alt="">' : '') +
        '<span class="att-name">' + esc(a.name) + '</span>' +
        '<button data-i="' + i + '" title="Remove">' + ICONS.x + '</button></span>';
    }).join('');
    updateSendState();
  }
  $('#attachments').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-i]');
    if (!b) return;
    attachments.splice(+b.getAttribute('data-i'), 1);
    renderAttachments();
  });

  // -------------------------------------------------------------------------
  // Chat — build payload & stream
  // -------------------------------------------------------------------------
  function historyForApi(chat) {
    var msgs = [];
    if (settings.systemPrompt && settings.systemPrompt.trim()) {
      msgs.push({ role: 'system', content: settings.systemPrompt.trim() });
    }
    chat.messages.forEach(function (m) {
      if (m.role === 'user') {
        if (typeof m.content === 'string' && m.content) msgs.push({ role: 'user', content: m.content });
        else if (Array.isArray(m.content)) msgs.push({ role: 'user', content: m.content });
      } else if (!m.error) {
        var c = m.content || '';
        if (m.image && !c) c = '(generated an image)';
        if (c) msgs.push({ role: 'assistant', content: c });
      }
    });
    return msgs;
  }

  function buildPayload(chat) {
    var model = settings.model || 'grok-4.1';
    var payload = {
      model: model,
      messages: historyForApi(chat),
      stream: true
    };
    if (settings.temperature !== '' && settings.temperature != null && !isNaN(settings.temperature)) {
      payload.temperature = Number(settings.temperature);
    }
    if (modes.think) {
      payload.reasoning_effort = 'high';
      if (/3-mini/.test(model)) payload.include_reasoning = true;
    }
    if (modes.deep) {
      payload.search_parameters = { mode: 'auto', return_citations: true };
    }
    return payload;
  }

  function stripExperimental(p) {
    var q = JSON.parse(JSON.stringify(p));
    delete q.reasoning_effort;
    delete q.include_reasoning;
    delete q.search_parameters;
    return q;
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

  function ensureChat() {
    var chat = currentChat();
    if (chat) return chat;
    chat = { id: uid(), title: 'New chat', messages: [], createdAt: Date.now(), updatedAt: Date.now() };
    chats.unshift(chat);
    currentId = chat.id;
    return chat;
  }

  function sendChat(text) {
    var chat = ensureChat();

    var content = text;
    var textFiles = attachments.filter(function (a) { return a.kind === 'text'; });
    var images = attachments.filter(function (a) { return a.kind === 'image'; });
    if (textFiles.length) {
      var blocks = textFiles.map(function (a) {
        return '[Attached file: ' + a.name + ']\n```\n' + a.text + '\n```';
      });
      content = (content ? content + '\n\n' : '') + blocks.join('\n\n');
    }
    if (images.length) {
      var parts = [];
      if (content) parts.push({ type: 'text', text: content });
      images.forEach(function (a) { parts.push({ type: 'image_url', image_url: { url: a.url } }); });
      content = parts;
    }

    chat.messages.push({ role: 'user', content: content });
    if (chat.title === 'New chat') {
      var t = userText(content).trim().split('\n')[0];
      chat.title = (t || 'New chat').slice(0, 42);
    }
    chat.updatedAt = Date.now();
    input.value = '';
    autoresize();
    attachments = [];
    renderAttachments();
    saveChats();
    renderThread();
    renderList();

    streamReply(chat);
  }

  function streamReply(chat) {
    var payload = buildPayload(chat);
    var assistant = { role: 'assistant', content: '', reasoning: '', citations: [], pending: true };
    chat.messages.push(assistant);
    chat.updatedAt = Date.now();

    // remove empty state, append streaming message element
    var empty = $('#empty-state');
    if (empty) empty.remove();
    var wrap = document.createElement('div');
    wrap.className = 'msg';
    wrap.innerHTML = '<div class="msg-ai-wrap"><div class="ai-content"><span class="shimmer-word">' +
      (modes.deep ? 'Searching' : 'Grok') + '</span></div></div>';
    $('#thread').appendChild(wrap);
    scrollToEnd(true);

    var contentEl = wrap.querySelector('.ai-content');
    var started = false;      // got first token (reasoning or content)
    var contentStarted = false;
    var thinkT0 = 0;
    var rafPending = false;
    streaming = true;
    updateSendState();
    controller = new AbortController();

    function paint() {
      rafPending = false;
      if (assistant.reasoning && !contentStarted) {
        // live thinking panel
        if (!wrap.querySelector('.think')) {
          contentEl.insertAdjacentHTML('beforebegin',
            '<details class="think" open><summary>' + ICONS.chevR + '<span class="th-label">Thinking…</span></summary>' +
            '<div class="think-body"></div></details>');
        }
        var body = wrap.querySelector('.think-body');
        if (body && body.textContent !== assistant.reasoning) body.textContent = assistant.reasoning;
        var lbl = wrap.querySelector('.th-label');
        if (lbl) lbl.textContent = 'Thinking… ' + Math.max(1, Math.round((Date.now() - thinkT0) / 1000)) + 's';
      } else if (assistant.reasoning && contentStarted) {
        var det = wrap.querySelector('.think');
        if (det) {
          det.removeAttribute('open');
          det.querySelector('.th-label').textContent = 'Thought for ' + assistant.thinkSecs + 's';
        }
      }
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
      assistant.pending = false;
      if (aborted) assistant.stopped = true;
      if (assistant.reasoning && !assistant.thinkSecs) {
        assistant.thinkSecs = Math.max(1, Math.round((Date.now() - thinkT0) / 1000));
      }
      contentEl.classList.remove('stream-cursor');
      chat.updatedAt = Date.now();
      saveChats();
      renderThread();   // re-render for actions row
      renderList();
      updateSendState();
    }

    async function run() {
      var resp = await postJson('/api/chat', Object.assign({}, payload));
      if (!resp.ok) {
        var errText = await resp.text();
        var errMsg = extractError(errText);
        // some endpoints reject reasoning/search params — retry once without
        if (resp.status === 400 && (payload.reasoning_effort || payload.include_reasoning || payload.search_parameters)) {
          payload = stripExperimental(payload);
          resp = await postJson('/api/chat', Object.assign({}, payload));
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
          if (ev.citations && ev.citations.length) {
            assistant.citations = assistant.citations.concat(ev.citations);
          }
          if (delta.reasoning_content) {
            if (!started) { started = true; thinkT0 = Date.now(); contentEl.innerHTML = ''; }
            assistant.reasoning += delta.reasoning_content;
            schedulePaint();
          }
          if (delta.content) {
            if (!started) { started = true; contentEl.innerHTML = ''; }
            if (!contentStarted) {
              contentStarted = true;
              if (assistant.reasoning) {
                assistant.thinkSecs = Math.max(1, Math.round((Date.now() - thinkT0) / 1000));
              }
            }
            assistant.content += delta.content;
            schedulePaint();
          }
        }
      }
      finalize(false);
    }

    run().catch(function (err) {
      if (controller && controller.signal.aborted) {
        finalize(true);
      } else {
        assistant.error = 'Network error: ' + (err && err.message || err);
        finalize(false);
      }
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

  // -------------------------------------------------------------------------
  // Image generation
  // -------------------------------------------------------------------------
  function sendImage(prompt) {
    var chat = ensureChat();
    chat.messages.push({ role: 'user', content: prompt });
    if (chat.title === 'New chat') chat.title = ('🖼 ' + prompt).slice(0, 42);
    input.value = '';
    autoresize();
    saveChats();
    renderThread();
    renderList();

    var assistant = { role: 'assistant', content: '', image: '', pending: true };
    chat.messages.push(assistant);
    var empty = $('#empty-state');
    if (empty) empty.remove();
    var wrap = document.createElement('div');
    wrap.className = 'msg';
    wrap.innerHTML = '<div class="msg-ai-wrap"><div class="ai-content"><span class="shimmer-word">Creating image…</span></div></div>';
    $('#thread').appendChild(wrap);
    scrollToEnd(true);
    streaming = true;
    updateSendState();

    postJson('/api/image', { model: 'grok-2-image', prompt: prompt, n: 1 })
      .then(function (r) { return r.text().then(function (t) { return { ok: r.ok, text: t }; }); })
      .then(function (res) {
        if (!res.ok) {
          assistant.error = extractError(res.text) || ('Image request failed');
        } else {
          var j = {};
          try { j = JSON.parse(res.text); } catch (e) {}
          var d = j.data && j.data[0] || {};
          if (d.url) assistant.image = d.url;
          else if (d.b64_json) assistant.image = 'data:image/jpeg;base64,' + d.b64_json;
          else assistant.error = 'No image in response — does this endpoint support image generation?';
        }
        assistant.pending = false;
        streaming = false;
        chat.updatedAt = Date.now();
        saveChats();
        renderThread();
        renderList();
        updateSendState();
      })
      .catch(function (err) {
        assistant.error = 'Network error: ' + (err && err.message || err);
        assistant.pending = false;
        streaming = false;
        saveChats();
        renderThread();
        updateSendState();
      });
  }

  // -------------------------------------------------------------------------
  // Model menu
  // -------------------------------------------------------------------------
  function renderModelMenu() {
    var menu = $('#model-menu');
    menu.innerHTML = MODELS.map(function (m) {
      return '<button class="menu-item' + (m.id === settings.model ? ' selected' : '') + '" data-model="' + m.id + '">' +
        '<span class="mi-check">' + ICONS.check + '</span>' +
        '<span class="mi-body"><div class="mi-name">' + esc(m.name) + '</div><div class="mi-desc">' + esc(m.desc) + '</div></span>' +
        '</button>';
    }).join('');
    var name = modelLabel(settings.model);
    $('#model-name').textContent = name;
  }
  function modelLabel(id) {
    for (var i = 0; i < MODELS.length; i++) if (MODELS[i].id === id) return MODELS[i].name;
    return id;
  }
  $('#model-btn').addEventListener('click', function (e) {
    e.stopPropagation();
    $('#model-menu').classList.toggle('hidden');
  });
  $('#model-menu').addEventListener('click', function (e) {
    var item = e.target.closest('[data-model]');
    if (!item) return;
    settings.model = item.getAttribute('data-model');
    saveSettings();
    renderModelMenu();
    this.classList.add('hidden');
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.model-select')) $('#model-menu').classList.add('hidden');
  });

  // -------------------------------------------------------------------------
  // Theme
  // -------------------------------------------------------------------------
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', settings.theme);
    var label = $('.theme-label');
    if (label) label.textContent = settings.theme === 'dark' ? 'Light mode' : 'Dark mode';
  }
  $('#btn-theme').addEventListener('click', function () {
    settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
    saveSettings();
    applyTheme();
  });

  // -------------------------------------------------------------------------
  // Settings modal
  // -------------------------------------------------------------------------
  function openSettings() {
    $('#set-key').value = settings.apiKey;
    $('#set-base').value = settings.baseUrl;
    $('#set-sys').value = settings.systemPrompt;
    $('#set-temp').value = settings.temperature;
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
    settings.systemPrompt = $('#set-sys').value;
    settings.temperature = $('#set-temp').value.trim();
    saveSettings();
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
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ base_url: $('#set-base').value.trim() || undefined })
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.ok) { out.className = 'ok'; out.textContent = '✓ OK — ' + j.count + ' models visible'; }
        else { out.className = 'bad'; out.textContent = '✗ ' + (j.message || 'failed'); }
      })
      .catch(function (e) {
        out.className = 'bad';
        out.textContent = '✗ ' + (e && e.message || e);
      });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeSettings();
      $('#model-menu').classList.add('hidden');
    }
  });

  // -------------------------------------------------------------------------
  // Sidebar open/close (desktop collapse + mobile overlay)
  // -------------------------------------------------------------------------
  function isMobile() { return window.innerWidth <= 860; }
  function closeMobileSidebar() { $('#app').classList.remove('sb-mobile-open'); }
  $('#sb-close').addEventListener('click', function () {
    if (isMobile()) closeMobileSidebar();
    else $('#app').classList.add('sb-collapsed');
  });
  $('#sb-open').addEventListener('click', function () {
    if (isMobile()) $('#app').classList.add('sb-mobile-open');
    else $('#app').classList.remove('sb-collapsed');
  });
  $('#scrim').addEventListener('click', closeMobileSidebar);
  $('#btn-new').addEventListener('click', function () {
    if (streaming) { toast('Wait for the current reply to finish (or stop it)'); return; }
    currentId = null;
    renderThread();
    renderList();
    input.focus();
    closeMobileSidebar();
  });

  // -------------------------------------------------------------------------
  // Boot
  // -------------------------------------------------------------------------
  applyTheme();
  renderModelMenu();
  renderList();
  updateSendState();
  fetch('/api/health')
    .then(function (r) { return r.json(); })
    .then(function (j) { serverHasKey = !!j.hasKey; })
    .catch(function () {});
  input.focus();
})();
