/**
 * GrokBot markdown renderer — dependency-free, XSS-safe (escapes first), and
 * good enough for LLM output: fenced code, inline code, headings, lists
 * (nested), blockquotes, tables, links/images, bold/italic/strikethrough.
 */
(function () {
  'use strict';

  var codeStore = [];

  function escapeHtml(s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function inline(s) {
    s = s.replace(/`([^`\n]+)`/g, function (m, c) {
      return '<code class="ic">' + c + '</code>';
    });
    s = s.replace(/!\[([^\]]*)\]\((https?:[^\s)]+)\)/g, function (m, alt, url) {
      return '<img src="' + url + '" alt="' + alt + '" loading="lazy">';
    });
    s = s.replace(/\[([^\]]+)\]\((https?:[^\s)]+)\)/g, function (m, t, url) {
      return '<a href="' + url + '" target="_blank" rel="noopener">' + t + '</a>';
    });
    s = s.replace(/(^|[\s(])((?:https?:\/\/)[^\s<)]+)/g, function (m, pre, url) {
      return pre + '<a href="' + url + '" target="_blank" rel="noopener">' + url + '</a>';
    });
    s = s.replace(/\*\*\*([^*\n]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, '$1<em>$2</em>');
    s = s.replace(/(^|\s)_([^_\n]+)_(?=\s|$|[.,;:!?)])/g, '$1<em>$2</em>');
    s = s.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
    return s;
  }

  function isTableRow(line) { return /^\s*\|.*\|\s*$/.test(line); }
  function isTableSep(line) { return /^\s*\|?[\s:-]*-[-\s:|]*\|?\s*$/.test(line) && line.indexOf('-') >= 0; }

  function splitRow(line) {
    return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return c.trim(); });
  }

  function render(src) {
    codeStore = [];
    src = String(src == null ? '' : src).replace(/\r\n?/g, '\n');

    // Pull fenced code blocks out before anything else.
    src = src.replace(/```([\w+#.-]*)[ \t]*\n([\s\S]*?)(?:```|$)/g, function (m, lang, code) {
      codeStore.push({ lang: lang || 'text', code: code.replace(/\n$/, '') });
      return '\u0000B' + (codeStore.length - 1) + '\u0000';
    });

    src = escapeHtml(src);
    // Undo double-escaping inside code placeholders is unnecessary — the
    // \u0000 token contains no escapable characters.

    var lines = src.split('\n');
    var out = [];
    var i = 0;
    var para = [];

    function flushPara() {
      if (para.length) {
        out.push('<p>' + para.map(inline).join('<br>') + '</p>');
        para = [];
      }
    }

    function parseList() {
      var items = [];          // { indent, ordered, text }
      while (i < lines.length) {
        var m = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
        if (!m) {
          // allow wrapped continuation lines that are indented
          if (items.length && /^\s+\S/.test(lines[i]) && !/^\s*(#{1,6}\s|>|\||```)/.test(lines[i])) {
            items[items.length - 1].text += ' ' + lines[i].trim();
            i++;
            continue;
          }
          break;
        }
        items.push({
          indent: m[1].replace(/\t/g, '  ').length,
          ordered: /\d/.test(m[2]),
          text: m[3]
        });
        i++;
      }

      function build(start, indent) {
        var html = '', idx = start;
        var opened = null; // 'ul' | 'ol'
        while (idx < items.length) {
          var it = items[idx];
          if (it.indent < indent - 1) break;
          if (it.indent > indent + 1) {
            // nested sublist — attach to previous item
            var sub = build(idx, it.indent);
            if (html.lastIndexOf('</li>') === -1) {
              html += sub.html;
            } else {
              html = html.slice(0, html.lastIndexOf('</li>')) + sub.html + '</li>';
            }
            idx = sub.end;
            continue;
          }
          var tag = it.ordered ? 'ol' : 'ul';
          if (opened !== tag) {
            if (opened) html += '</' + opened + '>';
            html += '<' + tag + '>';
            opened = tag;
          }
          html += '<li>' + inline(it.text);
          // peek: is next item a deeper child?
          if (idx + 1 < items.length && items[idx + 1].indent > indent + 1) {
            var sub2 = build(idx + 1, items[idx + 1].indent);
            html += sub2.html;
            idx = sub2.end - 1;
          }
          html += '</li>';
          idx++;
        }
        if (opened) html += '</' + opened + '>';
        return { html: html, end: idx };
      }

      var res = build(0, items[0].indent);
      out.push(res.html);
    }

    while (i < lines.length) {
      var line = lines[i];

      // code placeholder on its own line
      var cb = line.match(/^\s*\u0000B(\d+)\u0000\s*$/);
      if (cb) {
        flushPara();
        out.push(codeBlockHtml(+cb[1]));
        i++;
        continue;
      }
      // inline code placeholder inside a paragraph
      if (line.indexOf('\u0000B') >= 0 && !/^\s*$/.test(line)) {
        para.push(inline(line));
        i++;
        continue;
      }

      if (/^\s*$/.test(line)) { flushPara(); i++; continue; }

      var h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        flushPara();
        var lvl = Math.min(h[1].length, 4);
        out.push('<h' + lvl + '>' + inline(h[2].replace(/#+\s*$/, '')) + '</h' + lvl + '>');
        i++;
        continue;
      }

      if (/^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        flushPara();
        out.push('<hr>');
        i++;
        continue;
      }

      if (/^\s*>/.test(line)) {
        flushPara();
        var quote = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) {
          quote.push(lines[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        out.push('<blockquote>' + render(quote.join('\n')) + '</blockquote>');
        continue;
      }

      if (/^\s*(?:[-*+]|\d+[.)])\s+/.test(line)) {
        flushPara();
        parseList();
        continue;
      }

      if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
        flushPara();
        var head = splitRow(line);
        i += 2;
        var body = [];
        while (i < lines.length && isTableRow(lines[i])) {
          body.push(splitRow(lines[i]));
          i++;
        }
        var t = '<table><thead><tr>';
        for (var c = 0; c < head.length; c++) t += '<th>' + inline(head[c]) + '</th>';
        t += '</tr></thead><tbody>';
        for (var r = 0; r < body.length; r++) {
          t += '<tr>';
          for (var c2 = 0; c2 < head.length; c2++) t += '<td>' + inline(body[r][c2] || '') + '</td>';
          t += '</tr>';
        }
        t += '</tbody></table>';
        out.push(t);
        continue;
      }

      para.push(line);
      i++;
    }
    flushPara();
    return out.join('\n');
  }

  function codeBlockHtml(idx) {
    var b = codeStore[idx];
    if (!b) return '';
    return '<div class="codeblock" data-code="' + idx + '">' +
      '<div class="cb-head"><span>' + escapeHtml(b.lang) + '</span>' +
      '<button class="cb-copy" type="button" data-code="' + idx + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
      'Copy</button></div>' +
      '<pre><code>' + escapeHtml(b.code) + '</code></pre></div>';
  }

  window.MD = {
    render: render,
    getCode: function (idx) { return codeStore[idx] ? codeStore[idx].code : ''; }
  };
})();
