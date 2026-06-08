/* ============================================================
   HUHGEON's Blog — Admin (owner-only, local) editor
   마크다운 에디터 · 실시간 미리보기 · 이미지 드래그&드롭 · 발행(.md 생성)
   ============================================================ */
(function () {
  'use strict';

  /* ---------- theme / owner ---------- */
  var TKEY = 'hg-theme';
  function applyTheme(t) { document.body.classList.toggle('light', t === 'light'); }
  applyTheme(localStorage.getItem(TKEY) || 'dark');
  (function () {
    var h = (location.hash || '').toLowerCase();
    if (h.indexOf('guest') > -1) localStorage.removeItem('hg-owner');
    if (localStorage.getItem('hg-owner') === null) localStorage.setItem('hg-owner', '1');
    document.body.classList.toggle('owner', localStorage.getItem('hg-owner') === '1');
  })();

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  /* ====================================================== */
  /*  Markdown parser (디자인 prose 와 동일 출력)            */
  /* ====================================================== */
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function inline(s) {
    s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function (_, alt, src) { return '<img src="' + src.trim() + '" alt="' + alt + '">'; });
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, txt, href) { return '<a href="' + href.trim() + '" target="_blank" rel="noopener">' + txt + '</a>'; });
    s = s.replace(/`([^`]+)`/g, function (_, c) { return '<code>' + c + '</code>'; });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    return s;
  }
  function highlightCode(code, lang) {
    var h = esc(code);
    h = h.replace(/(^|\n)(\s*(?:#|\/\/)[^\n]*)/g, function (_, br, c) { return br + '<span class="tok-com">' + c + '</span>'; });
    h = h.replace(/(&quot;[^&]*?&quot;|'[^']*?')/g, '<span class="tok-str">$1</span>');
    if (lang === 'yaml' || lang === 'yml' || lang === '') { h = h.replace(/(^|\n)(\s*[\w-]+)(:)/g, '$1<span class="tok-key">$2</span>$3'); }
    h = h.replace(/\b(const|let|var|function|return|if|else|for|while|import|from|export|class|true|false|null|def|new)\b/g, '<span class="tok-key">$1</span>');
    h = h.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-num">$1</span>');
    return h;
  }
  function md(src) {
    src = src.replace(/\r\n/g, '\n');
    var out = [], lines = src.split('\n'), i = 0;
    var para = [];
    function flushPara(buf) { if (buf.length) { out.push('<p>' + inline(buf.join(' ')) + '</p>'); buf.length = 0; } }
    while (i < lines.length) {
      var ln = lines[i];
      var fence = ln.match(/^```\s*(\w*)/);
      if (fence) {
        flushPara(para);
        var lang = fence[1] || '', body = []; i++;
        while (i < lines.length && !/^```/.test(lines[i])) { body.push(lines[i]); i++; }
        i++;
        if (lang === 'mermaid') { out.push('<div class="mermaid">' + esc(body.join('\n')) + '</div>'); continue; }
        out.push('<div class="codeblock"><div class="cb-head">' +
          '<span class="d" style="background:#cf8a93"></span><span class="d" style="background:#c2a06a"></span><span class="d" style="background:#86ad8e"></span>' +
          '<span class="lang">' + (lang || 'code') + '</span>' +
          '<button class="copy"><svg viewBox="0 0 384 512"><path d="M192 0c-41.8 0-77.4 26.7-90.5 64H64C28.7 64 0 92.7 0 128V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V128c0-35.3-28.7-64-64-64H282.5C269.4 26.7 233.8 0 192 0zm0 64a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"/></svg><span class="cl">Copy</span></button>' +
          '</div><pre>' + highlightCode(body.join('\n'), lang) + '</pre></div>');
        continue;
      }
      var hd = ln.match(/^(#{1,3})\s+(.*)$/);
      if (hd) {
        flushPara(para); var lvl = hd[1].length;
        if (lvl === 2) out.push('<h2><span class="hash">##</span>' + inline(hd[2]) + '</h2>');
        else if (lvl === 3) out.push('<h3>' + inline(hd[2]) + '</h3>');
        else out.push('<h2>' + inline(hd[2]) + '</h2>');
        i++; continue;
      }
      if (/^(---|\*\*\*|___)\s*$/.test(ln)) { flushPara(para); out.push('<hr>'); i++; continue; }
      // GFM 표: | h1 | h2 | 다음 줄이 | --- | --- |
      if (/^\s*\|.*\|\s*$/.test(ln) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
        flushPara(para);
        var splitRow = function (r) { return r.trim().replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); }); };
        var th = splitRow(ln); i += 2;
        var trs = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { trs.push(splitRow(lines[i])); i++; }
        var thead = '<thead><tr>' + th.map(function (h) { return '<th>' + inline(h) + '</th>'; }).join('') + '</tr></thead>';
        var tbody = '<tbody>' + trs.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody>';
        out.push('<div class="table-wrap"><table>' + thead + tbody + '</table></div>');
        continue;
      }
      if (/^>\s?/.test(ln)) { flushPara(para); var q = []; while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, '')); i++; } out.push('<blockquote><p>' + inline(q.join(' ')) + '</p></blockquote>'); continue; }
      if (/^\s*[-*]\s+/.test(ln)) { flushPara(para); var items = []; while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push('<li>' + inline(lines[i].replace(/^\s*[-*]\s+/, '')) + '</li>'); i++; } out.push('<ul>' + items.join('') + '</ul>'); continue; }
      if (/^\s*\d+\.\s+/.test(ln)) { flushPara(para); var oi = []; while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { oi.push('<li>' + inline(lines[i].replace(/^\s*\d+\.\s+/, '')) + '</li>'); i++; } out.push('<ol>' + oi.join('') + '</ol>'); continue; }
      if (/^\s*$/.test(ln)) { flushPara(para); i++; continue; }
      para.push(ln); i++;
    }
    flushPara(para);
    return out.join('\n');
  }

  /* ---------- date helper ---------- */
  function today() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function nowStamp() {   // "YYYY-MM-DD HH:MM:SS +0900" (브라우저 실제 시간대)
    var d = new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    var off = -d.getTimezoneOffset(), sign = off >= 0 ? '+' : '-'; off = Math.abs(off);
    var tz = sign + p(Math.floor(off / 60)) + p(off % 60);
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) + ' ' + tz;
  }

  /* ---------- Mermaid (에디터 미리보기) ---------- */
  function renderMermaidPv() {
    if (!window.mermaid) return;
    try {
      window.mermaid.initialize({ startOnLoad: false, securityLevel: 'loose',
        theme: document.body.classList.contains('light') ? 'neutral' : 'dark' });
      window.mermaid.run({ querySelector: '#ed-prose .mermaid' });
    } catch (e) {}
  }
  var mmLoading = false;
  function loadMermaid() {
    if (window.mermaid) { renderMermaidPv(); return; }
    if (mmLoading) return; mmLoading = true;
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
    s.onload = renderMermaidPv;
    s.onerror = function () { mmLoading = false; };
    document.head.appendChild(s);
  }

  /* ---------- view switching (#write / #manage) ---------- */
  function showView(v) {
    $$('.view').forEach(function (s) { s.classList.toggle('active', s.id === 'view-' + v); });
    document.body.classList.toggle('editing', v === 'editor');
    if (v === 'editor') { var t = $('#ed-title'); if (t) setTimeout(function () { t.focus(); }, 30); }
  }
  function routeHash() {
    var h = (location.hash || '').replace('#', '').toLowerCase();
    if (h === 'manage') showView('manage'); else showView('editor');
  }

  /* ---------- toast ---------- */
  var toastTimer;
  function toast(msg) {
    var el = $('#toast'), m = $('#toast-msg'); if (!el) return;
    if (m) m.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove('show'); }, 3400);
  }
  window.__toast = toast;

  /* ---------- 발행 진행 모달 (스피너 + 경과시간) ---------- */
  var pubTimer = null, pubStart = 0;
  function showPub(title, sub) {
    var m = $('#pub-modal'); if (!m) return;
    var t = $('#pub-title'), s = $('#pub-sub'), e = $('#pub-elapsed');
    if (t) t.textContent = title; if (s) s.textContent = sub;
    m.hidden = false;
    pubStart = Date.now();
    if (e) {
      clearInterval(pubTimer);
      e.textContent = '0:00 경과';
      pubTimer = setInterval(function () {
        var sec = Math.floor((Date.now() - pubStart) / 1000);
        e.textContent = Math.floor(sec / 60) + ':' + (sec % 60 < 10 ? '0' : '') + (sec % 60) + ' 경과';
      }, 1000);
    }
  }
  function updatePub(title, sub) {
    var t = $('#pub-title'), s = $('#pub-sub');
    if (title != null && t) t.textContent = title;
    if (sub != null && s) s.textContent = sub;
  }
  function hidePub() { var m = $('#pub-modal'); if (m) m.hidden = true; clearInterval(pubTimer); }

  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function () {
    /* theme toggle */
    var themeBtn = $('#theme');
    if (themeBtn) themeBtn.addEventListener('click', function () {
      var now = document.body.classList.contains('light') ? 'dark' : 'light';
      localStorage.setItem(TKEY, now); applyTheme(now);
    });

    /* nav buttons — '새 글 쓰기'는 항상 빈 에디터로 시작 */
    $$('[data-go]').forEach(function (b) {
      b.addEventListener('click', function () {
        var go = b.getAttribute('data-go');
        if (go === 'write') { localStorage.removeItem('hg-edit'); clearEditor(); }
        location.hash = go;
      });
    });
    window.addEventListener('hashchange', routeHash);
    routeHash();

    /* ====================================================== */
    /*  GitHub 로그인(OAuth) + 오너 판정                       */
    /* ====================================================== */
    function authConf() {
      var c = window.AUTH || {};
      var repo = (c.repo || '').trim(), branch = (c.branch || '').trim() || 'main';
      if (!repo) { var h = location.hostname; if (/\.github\.io$/.test(h)) repo = h.split('.')[0] + '/' + h; }
      return { repo: repo, branch: branch, ownerLogin: (c.ownerLogin || '').trim(), oauthUrl: (c.oauthUrl || '').trim().replace(/\/$/, '') };
    }
    function ghConf() { var a = authConf(); return { repo: a.repo, branch: a.branch }; }
    function ghToken() { return localStorage.getItem('hg-gh-token') || ''; }
    function ghUser() { return localStorage.getItem('hg-gh-user') || ''; }
    function isOwner() {
      var a = authConf();
      return !!ghToken() && !!ghUser() && (!a.ownerLogin || ghUser() === a.ownerLogin);
    }

    function fetchUser(token) {
      return fetch('https://api.github.com/user', { headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json' } })
        .then(function (r) { if (!r.ok) throw new Error('user ' + r.status); return r.json(); });
    }
    function setSession(token, login) {
      if (token) localStorage.setItem('hg-gh-token', token); else localStorage.removeItem('hg-gh-token');
      if (login) localStorage.setItem('hg-gh-user', login); else localStorage.removeItem('hg-gh-user');
    }
    function applyAuth() {
      var gate = $('#auth-gate'), label = $('#ed-gh-label'), ghBtn = $('#ed-gh');
      var a = authConf();
      if (isOwner()) {
        document.body.classList.add('owner');
        if (gate) gate.hidden = true;
        if (label) label.textContent = '로그아웃 (' + ghUser() + ')';
        if (ghBtn) ghBtn.classList.add('on-connected');
      } else {
        document.body.classList.remove('owner');
        if (gate) {
          gate.hidden = false;
          var title = $('#auth-title'), desc = $('#auth-desc');
          if (ghToken() && ghUser() && a.ownerLogin && ghUser() !== a.ownerLogin) {
            if (title) title.textContent = '접근 권한이 없어요';
            if (desc) desc.textContent = '@' + ghUser() + ' 계정은 이 블로그의 주인(@' + a.ownerLogin + ')이 아니에요. 주인 계정으로 로그인하세요.';
          } else {
            if (title) title.textContent = '오너 전용 작업실';
            if (desc) desc.textContent = '글쓰기·관리·발행은 저장소 주인만 가능합니다. GitHub로 로그인하세요.';
          }
        }
        if (label) label.textContent = 'GitHub 로그인';
        if (ghBtn) ghBtn.classList.remove('on-connected');
      }
    }

    function loginGitHub() {
      var a = authConf();
      if (!a.oauthUrl) { return connectViaPAT(); }   // 워커 미설정 시 PAT 폴백
      var w = window.open(a.oauthUrl + '/auth', 'gh_login', 'width=640,height=760');
      var workerOrigin; try { workerOrigin = new URL(a.oauthUrl).origin; } catch (e) { workerOrigin = '*'; }
      function onMsg(e) {
        if (workerOrigin !== '*' && e.origin !== workerOrigin) return;
        var d = e.data; if (!d || d.type !== 'gh-oauth') return;
        window.removeEventListener('message', onMsg);
        if (d.error || !d.token) { toast('로그인 실패: ' + (d.error || '토큰 없음')); return; }
        toast('로그인 확인 중…');
        fetchUser(d.token).then(function (u) {
          setSession(d.token, u.login); applyAuth();
          toast('✅ @' + u.login + ' 로 로그인됐어요');
        }).catch(function (err) { toast('로그인 실패: ' + err.message); });
      }
      window.addEventListener('message', onMsg);
    }
    function connectViaPAT() {
      var t = prompt('GitHub Personal Access Token 을 붙여넣으세요.\n(OAuth 로그인을 쓰려면 _config.yml 의 oauth_url 을 설정하세요)\n· 권한: 이 저장소 Contents 쓰기\n· 이 브라우저에만 저장됩니다', ghToken());
      if (t === null) return false;
      t = t.trim();
      if (!t) { setSession('', ''); applyAuth(); return false; }
      fetchUser(t).then(function (u) { setSession(t, u.login); applyAuth(); toast('✅ @' + u.login + ' 연결됨'); })
        .catch(function (err) { toast('토큰 확인 실패: ' + err.message); });
      return true;
    }
    function logoutGitHub() { setSession('', ''); applyAuth(); toast('로그아웃했어요'); }

    function b64(str) { return btoa(unescape(encodeURIComponent(str))); }
    function urlToPath(url) {
      var u = String(url || '').replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '');
      try { u = decodeURIComponent(u); } catch (e) {}
      u = u.replace(/\.html$/, '.md');
      return '_pages/' + u;
    }
    function ghApiUrl(conf, path) {
      return 'https://api.github.com/repos/' + conf.repo + '/contents/' +
        path.split('/').map(encodeURIComponent).join('/');
    }
    function githubPutFile(conf, token, path, content, message) {
      var headers = { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json' };
      var api = ghApiUrl(conf, path);
      return fetch(api + '?ref=' + encodeURIComponent(conf.branch), { headers: headers })
        .then(function (g) {
          if (g.status === 200) return g.json().then(function (j) { return j.sha; });
          if (g.status === 404) return null;
          return g.json().catch(function () { return {}; }).then(function (j) { throw new Error((j.message || ('GET ' + g.status))); });
        })
        .then(function (sha) {
          var body = { message: message, content: b64(content), branch: conf.branch };
          if (sha) body.sha = sha;
          return fetch(api, { method: 'PUT', headers: headers, body: JSON.stringify(body) });
        })
        .then(function (p) {
          if (p.status === 200 || p.status === 201) return p.json();
          return p.json().catch(function () { return {}; }).then(function (j) { throw new Error((j.message || ('PUT ' + p.status))); });
        });
    }
    window.__ghPutFile = githubPutFile; window.__ghConf = ghConf; window.__ghToken = ghToken;

    // 커밋 SHA의 Actions 배포가 끝나면 글로 이동 (새 글·수정 모두 정확)
    function pollDeploy(sha, postUrl) {
      var conf = ghConf(), token = ghToken();
      if (!sha || !conf.repo || !token) { setTimeout(function () { location.href = postUrl; }, 90000); return; }
      var tries = 0;
      var poll = setInterval(function () {
        tries++;
        fetch('https://api.github.com/repos/' + conf.repo + '/actions/runs?head_sha=' + sha + '&per_page=1',
          { headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json' } })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            var run = j && j.workflow_runs && j.workflow_runs[0];
            if (run && run.status === 'completed') { clearInterval(poll); updatePub('배포 완료! 글로 이동 중…', ''); setTimeout(function () { location.href = postUrl + '?t=' + Date.now(); }, 2500); }
            else if (run && run.status === 'in_progress') { updatePub('배포 중…', '빌드가 진행 중이에요 (보통 1~2분)'); if (tries >= 40) { clearInterval(poll); location.href = postUrl; } }
            else if (tries >= 40) { clearInterval(poll); location.href = postUrl; }
          })
          .catch(function () { if (tries >= 40) { clearInterval(poll); location.href = postUrl; } });
      }, 6000);
    }
    window.__pollDeploy = pollDeploy;

    /* ---------- 에디터 비우기 / 수정 글 불러오기 ---------- */
    var edRender = function () {};
    var editingUrl = '';
    var editingDate = '';   // 수정 중인 글의 최초 등록일("2026.06.08")
    function clearEditor() {
      var t = $('#ed-title'), g = $('#ed-tags'), a = $('#ed-area'), c = $('#ed-cat');
      if (t) t.value = ''; if (g) g.value = ''; if (a) a.value = '';
      if (c && c.options.length) c.selectedIndex = 0;
      editingUrl = ''; editingDate = '';
      edRender();
    }
    function loadEditDraft() {
      var raw; try { raw = JSON.parse(localStorage.getItem('hg-edit')); } catch (e) {}
      if (!raw) return false;
      editingUrl = raw.url || '';
      editingDate = raw.date || '';
      var t = $('#ed-title'), g = $('#ed-tags'), a = $('#ed-area'), c = $('#ed-cat');
      if (t) t.value = raw.title || '';
      if (g) g.value = raw.tags || '';
      if (a) a.value = raw.body || '';
      // 카테고리 select 값 맞추기 ("Cat · Sub" 형식) — manage.js 렌더 이후 보장
      if (c) {
        var want = (raw.cat || '') + (raw.sub ? ' · ' + raw.sub : '');
        var set = function () {
          var found = false;
          Array.prototype.forEach.call(c.options, function (o) { if (o.value === want || o.textContent.trim() === want) { c.value = o.value; found = true; } });
          if (!found && raw.cat) { Array.prototype.forEach.call(c.options, function (o) { if (o.textContent.indexOf(raw.cat) === 0) c.value = o.value; }); }
          edRender();
        };
        set(); setTimeout(set, 60);
      }
      edRender();
      return true;
    }

    /* ---------- Editor ---------- */
    var area = $('#ed-area');
    if (area) {
      var prev = $('#ed-prose');
      var tEl = $('#ed-title'), cEl = $('#ed-cat'), gEl = $('#ed-tags');
      var pvTitle = $('#pv-title'), pvCat = $('#pv-cat'), pvTags = $('#pv-tags'), pvDate = $('#pv-date');
      var uploadedImages = {};   // { 사이트경로: dataURL } — 배포 전 미리보기용

      function render() {
        prev.innerHTML = md(area.value);
        // 업로드한 이미지는 아직 배포 전이라, 미리보기에선 방금 읽은 데이터로 보여줌
        Array.prototype.forEach.call(prev.querySelectorAll('img'), function (img) {
          var s = img.getAttribute('src');
          if (uploadedImages[s]) img.src = uploadedImages[s];
        });
        if (prev.querySelector('.mermaid')) loadMermaid();   // mermaid 다이어그램 렌더
        var title = (tEl.value || '').trim();
        pvTitle.textContent = title || '제목 없음';
        pvCat.textContent = cEl.value || 'Uncategorized';
        var tags = (gEl.value || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        pvTags.innerHTML = tags.map(function (t) { return '<span class="tag">' + t + '</span>'; }).join('');
        var fn = $('#ed-file');
        if (fn) {
          var slug = title.toLowerCase().replace(/[^\w가-힣\s-]/g, '').replace(/\s+/g, '-').slice(0, 28) || 'untitled';
          fn.textContent = today() + '-' + slug + '.md';
        }
      }
      edRender = render;
      [area, tEl, cEl, gEl].forEach(function (el) { if (el) el.addEventListener('input', render); });

      function wrap(before, after, ph) {
        var s = area.selectionStart, e = area.selectionEnd;
        var sel = area.value.slice(s, e) || ph || '';
        area.value = area.value.slice(0, s) + before + sel + after + area.value.slice(e);
        area.focus(); area.selectionStart = s + before.length; area.selectionEnd = s + before.length + sel.length; render();
      }
      function linePrefix(prefix) {
        var s = area.selectionStart;
        var ls = area.value.lastIndexOf('\n', s - 1) + 1;
        area.value = area.value.slice(0, ls) + prefix + area.value.slice(ls);
        area.focus(); area.selectionStart = area.selectionEnd = s + prefix.length; render();
      }
      $$('.ed-tool').forEach(function (b) {
        b.addEventListener('click', function () {
          var act = b.getAttribute('data-md');
          if (act === 'h2') linePrefix('## ');
          else if (act === 'h3') linePrefix('### ');
          else if (act === 'bold') wrap('**', '**', '굵게');
          else if (act === 'italic') wrap('*', '*', '기울임');
          else if (act === 'code') wrap('`', '`', 'code');
          else if (act === 'codeblock') wrap('\n```js\n', '\n```\n', 'console.log("hi")');
          else if (act === 'quote') linePrefix('> ');
          else if (act === 'list') linePrefix('- ');
          else if (act === 'table') insertAtCursor('\n| 제목1 | 제목2 | 제목3 |\n| --- | --- | --- |\n| 내용 | 내용 | 내용 |\n| 내용 | 내용 | 내용 |\n');
          else if (act === 'mermaid') insertAtCursor('\n```mermaid\nflowchart TD\n  A[시작] --> B{조건}\n  B -->|예| C[처리]\n  B -->|아니오| D[종료]\n```\n');
          else if (act === 'link') wrap('[', '](https://)', '링크');
          else if (act === 'image') wrap('![', '](https://)', 'alt');
        });
      });
      area.addEventListener('keydown', function (e) {
        if (e.key === 'Tab') { e.preventDefault(); var s = area.selectionStart; area.value = area.value.slice(0, s) + '  ' + area.value.slice(area.selectionEnd); area.selectionStart = area.selectionEnd = s + 2; }
      });

      function insertAtCursor(text) { var s = area.selectionStart, e = area.selectionEnd; area.value = area.value.slice(0, s) + text + area.value.slice(e); area.selectionStart = area.selectionEnd = s + text.length; area.focus(); render(); }
      // URL 을 한 줄(공백/줄바꿈 없이)로 인코딩
      function encodeOneLine(url) {
        url = String(url).replace(/\s+/g, '');           // 줄바꿈/공백 제거 → 한 줄
        if (url.indexOf('data:') === 0) return url;       // data URL 은 이미 안전
        try { return encodeURI(url); } catch (e) { return url; }
      }
      // 이미지를 GitHub(assets/img/uploads/)에 파일로 업로드 → 본문엔 경로만 삽입 (data 안 박음)
      function uploadImage(repoPath, dataUrl, fname) {
        var a = authConf(), token = ghToken();
        if (!a.repo || !token) { toast('이미지 업로드는 GitHub 로그인이 필요해요'); return; }
        var b64 = (dataUrl.split(',')[1]) || '';
        var api = 'https://api.github.com/repos/' + a.repo + '/contents/' + repoPath.split('/').map(encodeURIComponent).join('/');
        fetch(api, {
          method: 'PUT',
          headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json' },
          body: JSON.stringify({ message: 'upload image: ' + fname, content: b64, branch: a.branch })
        }).then(function (r) {
          if (r.status === 201 || r.status === 200) toast('이미지 업로드됨: ' + fname);
          else r.json().then(function (e) { toast('이미지 업로드 실패: ' + (e.message || r.status)); });
        }).catch(function (e) { toast('이미지 업로드 실패: ' + e.message); });
      }
      function handleImageFiles(files) {
        Array.prototype.forEach.call(files, function (f) {
          if (!f || f.type.indexOf('image/') !== 0) return;
          var reader = new FileReader();
          reader.onload = function (ev) {
            var dataUrl = ev.target.result;
            var ext = ((f.name || '').split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
            var base = (f.name || 'image').replace(/\.[^.]+$/, '').toLowerCase().replace(/[^\w가-힣]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'img';
            var rand = Math.random().toString(36).slice(2, 7);
            var fname = today() + '-' + rand + '-' + base + '.' + ext;
            var repoPath = 'assets/img/uploads/' + fname;
            var sitePath = '/assets/img/uploads/' + fname;
            uploadedImages[sitePath] = dataUrl;                       // 미리보기용
            insertAtCursor('\n![' + (f.name || 'image') + '](' + sitePath + ')\n');   // 본문엔 경로만
            uploadImage(repoPath, dataUrl, fname);                    // GitHub에 파일로 업로드
          };
          reader.readAsDataURL(f);
        });
      }
      // 이미지 툴바/링크로 직접 넣은 URL 도 한 줄 인코딩
      window.__encodeOneLine = encodeOneLine;
      area.addEventListener('dragover', function (e) { e.preventDefault(); area.classList.add('drag'); });
      area.addEventListener('dragleave', function () { area.classList.remove('drag'); });
      area.addEventListener('drop', function (e) { e.preventDefault(); area.classList.remove('drag'); if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) handleImageFiles(e.dataTransfer.files); });
      area.addEventListener('paste', function (e) {
        var items = e.clipboardData && e.clipboardData.items; if (!items) return;
        for (var i = 0; i < items.length; i++) { if (items[i].type.indexOf('image/') === 0) { var f = items[i].getAsFile(); if (f) { e.preventDefault(); handleImageFiles([f]); } } }
      });

      $$('.ed-tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
          $$('.ed-tab').forEach(function (x) { x.classList.remove('on'); }); tab.classList.add('on');
          var which = tab.getAttribute('data-tab');
          $('.ed-pane.write').classList.toggle('shown', which === 'write');
          $('.ed-pane.preview').classList.toggle('shown', which === 'preview');
        });
      });

      /* copy buttons inside preview */
      document.addEventListener('click', function (e) {
        var cp = e.target.closest('.copy'); if (!cp) return;
        var pre = cp.closest('.codeblock').querySelector('pre');
        if (pre && navigator.clipboard) navigator.clipboard.writeText(pre.innerText);
        var t = cp.querySelector('.cl'); if (t) { var o = t.textContent; t.textContent = 'Copied'; setTimeout(function () { t.textContent = o; }, 1200); }
      });

      /* ---------- publish: GitHub 자동 커밋/푸시 (실패 시 .md 다운로드) ---------- */
      function buildDoc() {
        var title = (tEl.value || '').trim() || '제목 없음';
        var tags = (gEl.value || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        // 수정이면 최초 등록일 유지, 새 글이면 현재 시각(시:분:초)
        var dateStr = (editingUrl && editingDate) ? editingDate.replace(/\./g, '-') : nowStamp();
        var fm = ['---', 'title: "' + title.replace(/"/g, '\\"') + '"', 'date: "' + dateStr + '"'];
        if (editingUrl) fm.push('updated: "' + nowStamp() + '"');   // 수정일 기록(정렬엔 미사용)
        if (tags.length) { fm.push('tags:'); tags.forEach(function (t) { fm.push('    - ' + t); }); }
        // 썸네일은 자동 설정하지 않음 (본문 이미지가 커버로 중복되지 않게)
        fm.push('---', '');
        var slug = title.toLowerCase().replace(/[^\w가-힣\s-]/g, '').replace(/\s+/g, '-').slice(0, 40) || 'untitled';
        return { title: title, content: fm.join('\n') + area.value + '\n', slug: slug };
      }
      function catFolder() {
        var v = (cEl && cEl.value || '').trim();
        if (!v) return 'Blog';
        return v.split(/\s*·\s*/).join('/');   // "Cat · Sub" → "Cat/Sub"
      }
      function pathToUrl(mdPath) {   // _pages/A/B/file.md → /A/B/file.html (URL 인코딩)
        var u = mdPath.replace(/^_pages\//, '').replace(/\.md$/, '.html');
        return '/' + u.split('/').map(encodeURIComponent).join('/');
      }
      function downloadMd(content, fname) {
        var blob = new Blob([content], { type: 'text/markdown' });
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      }

      var pub = $('#ed-publish');
      if (pub) pub.addEventListener('click', function () {
        var doc = buildDoc();
        var path = editingUrl ? urlToPath(editingUrl) : ('_pages/' + catFolder() + '/' + today() + '-' + doc.slug + '.md');
        var fname = path.split('/').pop();
        var conf = ghConf(), token = ghToken();
        if (token && conf.repo) {
          pub.disabled = true;
          showPub('커밋 중…', 'GitHub에 글을 올리고 있어요');
          githubPutFile(conf, token, path, doc.content, (editingUrl ? 'edit: ' : 'post: ') + doc.title)
            .then(function (res) {
              localStorage.removeItem('hg-edit');
              var postUrl = editingUrl || pathToUrl(path);
              var sha = (res && res.commit && res.commit.sha) || '';
              updatePub('배포 중…', '빌드되면 자동으로 글로 이동해요 (보통 1~2분)');
              pollDeploy(sha, postUrl);
            })
            .catch(function (err) {
              hidePub();
              toast('푸시 실패(' + err.message + ') — .md 파일로 대신 받을게요');
              downloadMd(doc.content, fname);
              pub.disabled = false;
            });
        } else {
          toast('먼저 GitHub로 로그인하세요');
          loginGitHub();
        }
      });

      // 진입 모드: #edit 이면 수정 글 불러오기, 아니면 빈 에디터(새 글)
      var mode = (location.hash || '').toLowerCase();
      if (mode.indexOf('edit') > -1) { loadEditDraft(); }
      render();
    }

    /* ---------- 로그인/로그아웃 버튼 + 게이트 + 부팅 시 인증 적용 ---------- */
    var ghBtn = $('#ed-gh');
    if (ghBtn) ghBtn.addEventListener('click', function () { if (isOwner()) logoutGitHub(); else loginGitHub(); });
    var gateLogin = $('#auth-login');
    if (gateLogin) gateLogin.addEventListener('click', loginGitHub);
    applyAuth();
  });
})();
