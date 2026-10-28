// Mock OpenAI-compatible upstream for local end-to-end tests (not part of the app)
const http = require('http');
http.createServer((req, res) => {
  if (req.url === '/v1/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ data: [{ id: 'grok-test-1' }, { id: 'grok-test-2' }] }));
  }
  if (req.url === '/v1/chat/completions') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const chunks = [
      { choices: [{ delta: { reasoning_content: 'Let me think... ' } }] },
      { choices: [{ delta: { reasoning_content: 'step by step.' } }] },
      { choices: [{ delta: { content: 'Hello **world**!\n\n```js\nconsole.log(42)\n```' } }] },
      { choices: [{ delta: {} }], citations: ['https://example.com/a', 'https://example.org/b'] }
    ];
    let i = 0;
    const t = setInterval(() => {
      if (i < chunks.length) res.write('data: ' + JSON.stringify(chunks[i++]) + '\n\n');
      else { res.write('data: [DONE]\n\n'); clearInterval(t); res.end(); }
    }, 50);
    return;
  }
  if (req.url === '/v1/images/generations') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ data: [{ b64_json: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' }] }));
  }
  res.writeHead(404); res.end('{}');
}).listen(3999, () => console.log('mock upstream on 3999'));
