// Mock OpenAI-compatible upstream for local end-to-end tests (not part of the app)
const http = require('http');
http.createServer((req, res) => {
  if (req.url === '/v1/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ data: [{ id: 'grok-test-1' }, { id: 'grok-test-2' }] }));
  }
  if (req.url === '/v1/chat/completions') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      let zh = false;
      try {
        const msgs = JSON.parse(body).messages || [];
        const lastUser = [...msgs].reverse().find(m => m.role === 'user');
        zh = lastUser && /[\u4e00-\u9fff]/.test(typeof lastUser.content === 'string' ? lastUser.content : '');
      } catch (e) {}
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const reply = zh
        ? '搞定了，汇报如下：\n\n' +
          '- **未读 12 → 0**，其中 7 封订阅邮件已退订\n' +
          '- **3 封回复**已起草，等你过目\n' +
          '- 1 封客户退款邮件标了紧急，需要你拍板\n\n' +
          '```js\nconsole.log(42)\n```\n\n' +
          '收件箱已清零。草稿直接发吗？'
        : 'On it — here is the sweep:\n\n' +
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
    });
    return;
  }
  if (req.url === '/v1/images/generations') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ data: [{ b64_json: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' }] }));
  }
  res.writeHead(404); res.end('{}');
}).listen(3999, () => console.log('mock upstream on 3999'));
