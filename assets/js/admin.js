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
    h = h.replace(/\b(const|let|var|function|return|if|else|for|while|import|from|export|class|true|false|null|def|new)\b(?!=)/g, '<span class="tok-key">$1</span>');
    h = h.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-num">$1</span>');
    return h;
  }
  function md(src) {
    src = src.replace(/\r\n/g, '\n');
    var out = [], lines = src.split('\n'), i = 0;
    var para = [], paraStart = 0;
    // 각 블록 첫 태그에 data-line(원본 줄번호)을 심어 스크롤 동기화에 사용
    function wl(html, n) { return html.replace(/^(\s*<[a-zA-Z][\w-]*)/, '$1 data-line="' + n + '"'); }
    function flushPara(buf) { if (buf.length) { out.push(wl('<p>' + inline(buf.join(' ')) + '</p>', paraStart)); buf.length = 0; } }
    while (i < lines.length) {
      var ln = lines[i];
      var start = i;
      var fence = ln.match(/^```\s*(\w*)/);
      if (fence) {
        flushPara(para);
        var lang = fence[1] || '', body = []; i++;
        while (i < lines.length && !/^```/.test(lines[i])) { body.push(lines[i]); i++; }
        i++;
        if (lang === 'mermaid') { out.push(wl('<div class="mermaid">' + esc(body.join('\n')) + '</div>', start)); continue; }
        out.push(wl('<div class="codeblock"><div class="cb-head">' +
          '<span class="d" style="background:#cf8a93"></span><span class="d" style="background:#c2a06a"></span><span class="d" style="background:#86ad8e"></span>' +
          '<span class="lang">' + (lang || 'code') + '</span>' +
          '<button class="copy"><svg viewBox="0 0 384 512"><path d="M192 0c-41.8 0-77.4 26.7-90.5 64H64C28.7 64 0 92.7 0 128V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V128c0-35.3-28.7-64-64-64H282.5C269.4 26.7 233.8 0 192 0zm0 64a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"/></svg><span class="cl">Copy</span></button>' +
          '</div><pre>' + highlightCode(body.join('\n'), lang) + '</pre></div>', start));
        continue;
      }
      var hd = ln.match(/^(#{1,3})\s+(.*)$/);
      if (hd) {
        flushPara(para); var lvl = hd[1].length;
        if (lvl === 2) out.push(wl('<h2><span class="hash">##</span>' + inline(hd[2]) + '</h2>', start));
        else if (lvl === 3) out.push(wl('<h3>' + inline(hd[2]) + '</h3>', start));
        else out.push(wl('<h2>' + inline(hd[2]) + '</h2>', start));
        i++; continue;
      }
      if (/^(---|\*\*\*|___)\s*$/.test(ln)) { flushPara(para); out.push(wl('<hr>', start)); i++; continue; }
      // GFM 표: | h1 | h2 | 다음 줄이 | --- | --- |
      if (/^\s*\|.*\|\s*$/.test(ln) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
        flushPara(para);
        var splitRow = function (r) { return r.trim().replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); }); };
        var th = splitRow(ln); i += 2;
        var trs = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { trs.push(splitRow(lines[i])); i++; }
        var thead = '<thead><tr>' + th.map(function (h) { return '<th>' + inline(h) + '</th>'; }).join('') + '</tr></thead>';
        var tbody = '<tbody>' + trs.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody>';
        out.push(wl('<div class="table-wrap"><table>' + thead + tbody + '</table></div>', start));
        continue;
      }
      if (/^>\s?/.test(ln)) { flushPara(para); var q = []; while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, '')); i++; } out.push(wl('<blockquote><p>' + inline(q.join(' ')) + '</p></blockquote>', start)); continue; }
      if (/^\s*[-*]\s+/.test(ln)) { flushPara(para); var items = []; while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push('<li>' + inline(lines[i].replace(/^\s*[-*]\s+/, '')) + '</li>'); i++; } out.push(wl('<ul>' + items.join('') + '</ul>', start)); continue; }
      if (/^\s*\d+\.\s+/.test(ln)) { flushPara(para); var oi = []; while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { oi.push('<li>' + inline(lines[i].replace(/^\s*\d+\.\s+/, '')) + '</li>'); i++; } out.push(wl('<ol>' + oi.join('') + '</ol>', start)); continue; }
      if (/^\s*$/.test(ln)) { flushPara(para); i++; continue; }
      if (!para.length) paraStart = i;
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
  var mmTimer = null;
  function scheduleMermaid() {   // 타이핑 중 과도한 재렌더(빈블럭 깜빡임) 방지
    if (mmTimer) clearTimeout(mmTimer);
    mmTimer = setTimeout(loadMermaid, 350);
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

    /* 카테고리 관리용: 디렉터리 목록 / 파일 조회 / 삭제 */
    function ghHeaders(token) { return { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json' }; }
    function ghListDir(conf, token, path) {
      return fetch(ghApiUrl(conf, path) + '?ref=' + encodeURIComponent(conf.branch), { headers: ghHeaders(token) })
        .then(function (r) { if (r.status === 404) return []; if (!r.ok) throw new Error('LIST ' + r.status); return r.json(); });
    }
    function ghGetFile(conf, token, path) {
      return fetch(ghApiUrl(conf, path) + '?ref=' + encodeURIComponent(conf.branch), { headers: ghHeaders(token) })
        .then(function (r) { if (!r.ok) throw new Error('GET ' + r.status); return r.json(); });
    }
    function ghDeleteFile2(conf, token, path, sha, message) {
      return fetch(ghApiUrl(conf, path), { method: 'DELETE', headers: ghHeaders(token),
        body: JSON.stringify({ message: message, sha: sha, branch: conf.branch }) })
        .then(function (r) { if (r.status === 200) return r.json(); return r.json().catch(function () { return {}; }).then(function (e) { throw new Error(e.message || ('DEL ' + r.status)); }); });
    }
    function b64decodeUtf8(s) { try { return decodeURIComponent(escape(atob((s || '').replace(/\n/g, '')))); } catch (e) { return ''; } }
    window.__ghListDir = ghListDir; window.__ghGetFile = ghGetFile; window.__ghDeleteFile = ghDeleteFile2; window.__b64decode = b64decodeUtf8;
    window.__pub = { show: showPub, update: updatePub, hide: hidePub };

    // 커밋 SHA의 Actions 배포가 끝나고 → 글 페이지에 새 내용(marker)이 실제로 뜰 때까지 확인 후 이동
    // marker: 수정=수정시각 문자열(YYYY.MM.DD HH:MM), 새 글=제목. CDN 전파까지 기다려 "새로고침 필요" 방지.
    function pollDeploy(sha, postUrl, verify) {
      var conf = ghConf(), token = ghToken();
      function go() { location.href = postUrl + '?t=' + Date.now(); }
      function verifyThenGo() {
        updatePub('배포 완료! 반영 확인 중…', '새 내용이 뜨면 이동해요');
        var v = 0;
        var iv = setInterval(function () {
          v++;
          fetch(postUrl + '?t=' + Date.now() + '-' + v, { cache: 'no-store' })
            .then(function (r) { if (!r.ok) throw 0; return r.text(); })
            .then(function (html) { var ok; try { ok = !verify || verify(html); } catch (e) { ok = true; } if (ok || v >= 24) { clearInterval(iv); go(); } })
            .catch(function () { if (v >= 24) { clearInterval(iv); go(); } });
        }, 3000);
      }
      if (!sha || !conf.repo || !token) { setTimeout(verifyThenGo, 60000); return; }
      var tries = 0;
      var poll = setInterval(function () {
        tries++;
        fetch('https://api.github.com/repos/' + conf.repo + '/actions/runs?head_sha=' + sha + '&per_page=1',
          { headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json' } })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            var run = j && j.workflow_runs && j.workflow_runs[0];
            if (run && run.status === 'completed') { clearInterval(poll); verifyThenGo(); }
            else if (run && run.status === 'in_progress') { updatePub('배포 중…', '빌드가 진행 중이에요 (보통 1~2분)'); if (tries >= 40) { clearInterval(poll); verifyThenGo(); } }
            else if (tries >= 40) { clearInterval(poll); verifyThenGo(); }
          })
          .catch(function () { if (tries >= 40) { clearInterval(poll); verifyThenGo(); } });
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
      // 카테고리 부모/세부 select 값 맞추기 — manage.js 렌더 이후 보장
      if (c) {
        var set = function () {
          if (raw.cat) c.value = raw.cat;
          if (window.__fillSubcat) window.__fillSubcat(c.value, raw.sub || '');   // 부모의 자식 목록 채우고 세부 선택
          var subEl = $('#ed-subcat'); if (subEl) subEl.value = raw.sub || '';
          edRender();
        };
        set(); setTimeout(set, 60);
      }
      // POSTS 의 body 는 렌더된 HTML 이라, 원본 .md 를 GitHub raw 에서 받아 마크다운으로 교체.
      // (공개 repo → 토큰 불필요. 실패 시 위에서 채운 값 유지)
      if (a && editingUrl) {
        var conf = ghConf();
        if (conf && conf.repo) {
          var path = urlToPath(editingUrl).split('/').map(encodeURIComponent).join('/');
          var rawU = 'https://raw.githubusercontent.com/' + conf.repo + '/' + encodeURIComponent(conf.branch) + '/' + path;
          fetch(rawU, { cache: 'no-store' })
            .then(function (r) { if (!r.ok) throw new Error('raw ' + r.status); return r.text(); })
            .then(function (txt) {
              var body = txt.replace(/^﻿/, '').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
              body = body.replace(/^\r?\n/, '');   // front matter 다음의 빈 줄 한 개 제거
              a.value = body;
              edRender();
            })
            .catch(function () { /* 오프라인 등 실패 시 기존 본문 유지 */ });
        }
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
        if (prev.querySelector('.mermaid')) scheduleMermaid();   // mermaid 다이어그램 렌더(디바운스)
        var title = (tEl.value || '').trim();
        pvTitle.textContent = title || '제목 없음';
        var subElP = $('#ed-subcat'); var subvP = (subElP && subElP.value) || '';
        pvCat.textContent = (cEl.value || 'Uncategorized') + (subvP ? ' · ' + subvP : '');
        var tags = (gEl.value || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        pvTags.innerHTML = tags.map(function (t) { return '<span class="tag">' + t + '</span>'; }).join('');
        var fn = $('#ed-file');
        if (fn) {
          var slug = title.toLowerCase().replace(/[^\w가-힣\s-]/g, '').replace(/\s+/g, '-').slice(0, 28) || 'untitled';
          fn.textContent = today() + '-' + slug + '.md';
        }
        anchorsDirty = true;   // 내용이 바뀌었으니 스크롤 앵커 다시 계산 필요
      }
      edRender = render;
      var subEl0 = $('#ed-subcat');
      [area, tEl, cEl, gEl, subEl0].forEach(function (el) { if (el) el.addEventListener('input', render); });
      if (subEl0) subEl0.addEventListener('change', render);
      if (cEl) cEl.addEventListener('change', render);

      /* ── 편집창 ↔ 미리보기 줄번호 기반 스크롤 동기화 ──────────────
         미리보기의 각 블록은 data-line 으로 원본 줄번호를 안다.
         · 미리보기 픽셀: 블록의 실제 offset
         · 편집창 픽셀: textarea 와 똑같은 스타일의 숨은 mirror 로
           해당 줄의 실제 위치(줄바꿈 반영)를 측정
         이렇게 만든 (줄→픽셀) 앵커 테이블을 구간 보간해 반대쪽 위치를 구한다. */
      var preview = $('.ed-preview');
      var anchors = null, anchorsDirty = true, builtPH = -1, builtW = -1, mirror = null;

      function ensureMirror() {
        if (mirror) return mirror;
        mirror = document.createElement('div');
        var cs = getComputedStyle(area);
        ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing',
         'textTransform', 'tabSize', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'
        ].forEach(function (p) { mirror.style[p] = cs[p]; });
        mirror.style.position = 'absolute';
        mirror.style.left = '-9999px';
        mirror.style.top = '0';
        mirror.style.visibility = 'hidden';
        mirror.style.boxSizing = 'border-box';
        mirror.style.whiteSpace = 'pre-wrap';
        mirror.style.overflowWrap = 'break-word';
        mirror.style.wordBreak = cs.wordBreak;
        document.body.appendChild(mirror);
        return mirror;
      }

      function buildAnchors() {
        anchors = [];
        if (!preview) return;
        var nodes = $$('[data-line]', prev);
        if (!nodes.length) { builtPH = preview.scrollHeight; builtW = area.clientWidth; anchorsDirty = false; return; }
        // 1) 편집창 픽셀: mirror 에 줄별 마커를 넣고 한 번에 측정
        var m = ensureMirror();
        m.style.width = area.clientWidth + 'px';
        var srcLines = area.value.split('\n');
        var needed = nodes.map(function (n) { return +n.getAttribute('data-line'); });
        var uniq = needed.slice().sort(function (a, b) { return a - b; });
        var html = '', li = 0;
        for (var k = 0; k < srcLines.length; k++) {
          while (li < uniq.length && uniq[li] === k) { html += '<span class="__a"></span>'; li++; }
          html += esc(srcLines[k]) + '\n';
        }
        while (li < uniq.length) { html += '<span class="__a"></span>'; li++; }
        m.innerHTML = html;
        var mTop = m.getBoundingClientRect().top;
        var ePixByLine = {};
        var spans = m.querySelectorAll('.__a');
        for (var s = 0; s < uniq.length; s++) ePixByLine[uniq[s]] = spans[s].getBoundingClientRect().top - mTop;
        // 2) 미리보기 픽셀 + 앵커 결합
        var pTop = preview.getBoundingClientRect().top;
        nodes.forEach(function (n) {
          var line = +n.getAttribute('data-line');
          anchors.push({
            e: ePixByLine[line],
            p: n.getBoundingClientRect().top - pTop + preview.scrollTop
          });
        });
        anchors.sort(function (a, b) { return a.e - b.e; });
        builtPH = preview.scrollHeight; builtW = area.clientWidth; anchorsDirty = false;
      }

      function ensureAnchors() {
        if (anchors && !anchorsDirty && preview.scrollHeight === builtPH && area.clientWidth === builtW) return;
        buildAnchors();
      }

      // from('e'|'p') 쪽 픽셀 val 을 to 쪽 픽셀로 구간 보간
      function mapPix(val, from, to) {
        if (!anchors || !anchors.length) return val;
        if (val <= anchors[0][from]) {
          var f0 = anchors[0][from] > 0 ? val / anchors[0][from] : 0;
          return f0 * anchors[0][to];
        }
        for (var j = 0; j < anchors.length - 1; j++) {
          var a = anchors[j], b = anchors[j + 1];
          if (val >= a[from] && val <= b[from]) {
            var f = (b[from] - a[from]) > 0 ? (val - a[from]) / (b[from] - a[from]) : 0;
            return a[to] + f * (b[to] - a[to]);
          }
        }
        var last = anchors[anchors.length - 1];
        return last[to] + (val - last[from]);   // 마지막 앵커 이후는 1:1 (브라우저가 최대값으로 클램프)
      }

      if (preview) {
        var syncing = false;
        function unlock() { requestAnimationFrame(function () { syncing = false; }); }
        area.addEventListener('scroll', function () {
          if (syncing || area.clientWidth === 0 || preview.clientHeight === 0) return;
          ensureAnchors(); syncing = true;
          preview.scrollTop = mapPix(area.scrollTop, 'e', 'p'); unlock();
        });
        preview.addEventListener('scroll', function () {
          if (syncing || area.clientWidth === 0 || preview.clientHeight === 0) return;
          ensureAnchors(); syncing = true;
          area.scrollTop = mapPix(preview.scrollTop, 'p', 'e'); unlock();
        });
        window.addEventListener('resize', function () { anchorsDirty = true; });
      }

      /* ── 미리보기 확대/축소 (50%~150%, localStorage 저장) ── */
      (function () {
        var content = preview && preview.querySelector('.content');
        var valEl = $('#pv-zoom-val'), outBtn = $('#pv-zoom-out'), inBtn = $('#pv-zoom-in');
        if (!content || !valEl || !outBtn || !inBtn) return;
        var MIN = 50, MAX = 150, STEP = 10;
        var z = parseInt(localStorage.getItem('hg-pv-zoom') || '100', 10);
        if (isNaN(z)) z = 100;
        function apply() {
          z = Math.max(MIN, Math.min(MAX, z));
          content.style.zoom = (z / 100);
          valEl.textContent = z + '%';
          localStorage.setItem('hg-pv-zoom', String(z));
          anchorsDirty = true;   // 줌이 바뀌면 스크롤 앵커 다시 계산
        }
        outBtn.addEventListener('click', function () { z -= STEP; apply(); });
        inBtn.addEventListener('click', function () { z += STEP; apply(); });
        apply();
      })();

      // 텍스트 삽입은 value 재대입 대신 execCommand('insertText') 사용 →
      // textarea 네이티브 undo(Cmd/Ctrl+Z) 기록이 보존된다.
      // (insertText 는 현재 선택영역을 text 로 대체하고 input 이벤트도 발생시킨다)
      function insertText(text) {
        area.focus();
        var ok = false;
        try { ok = document.execCommand('insertText', false, text); } catch (e2) { ok = false; }
        if (!ok) {   // 구형 폴백(undo 는 깨지지만 동작은 보장)
          var s = area.selectionStart, e = area.selectionEnd;
          area.value = area.value.slice(0, s) + text + area.value.slice(e);
          area.selectionStart = area.selectionEnd = s + text.length;
          render();
        }
      }
      function wrap(before, after, ph) {
        area.focus();
        var s = area.selectionStart, e = area.selectionEnd;
        var sel = area.value.slice(s, e);   // 선택된 게 있으면 감싸고, 없으면 빈 형식 + 커서만 안쪽
        insertText(before + sel + after);
        area.selectionStart = s + before.length; area.selectionEnd = s + before.length + sel.length;
        render();
      }
      function linePrefix(prefix) {
        area.focus();
        var s = area.selectionStart;
        var ls = area.value.lastIndexOf('\n', s - 1) + 1;
        area.selectionStart = area.selectionEnd = ls;   // 줄 시작에 캐럿 → 거기에 prefix 삽입
        insertText(prefix);
        area.selectionStart = area.selectionEnd = s + prefix.length;
        render();
      }
      $$('.ed-tool').forEach(function (b) {
        b.addEventListener('click', function () {
          var act = b.getAttribute('data-md');
          if (act === 'h2') linePrefix('## ');
          else if (act === 'h3') linePrefix('### ');
          else if (act === 'bold') wrap('**', '**', '굵게');
          else if (act === 'italic') wrap('*', '*', '기울임');
          else if (act === 'code') wrap('`', '`', 'code');
          else if (act === 'codeblock') wrap('\n```\n', '\n```\n', '');
          else if (act === 'quote') linePrefix('> ');
          else if (act === 'list') linePrefix('- ');
          else if (act === 'table') {
            var nc = parseInt(window.prompt('열(세로 칸) 개수?', '3'), 10);
            if (!nc || nc < 1) return;
            var nr = parseInt(window.prompt('행(가로 줄) 개수? — 헤더 제외', '2'), 10);
            if (!nr || nr < 1) nr = 1;
            nc = Math.min(nc, 12); nr = Math.min(nr, 50);
            var emptyRow = '|', sep = '|';
            for (var ci = 0; ci < nc; ci++) { emptyRow += '  |'; sep += ' --- |'; }
            var out2 = '\n' + emptyRow + '\n' + sep + '\n';   // 헤더(빈칸) + 구분선
            for (var ri = 0; ri < nr; ri++) out2 += emptyRow + '\n';
            insertAtCursor(out2);
          }
          else if (act === 'mermaid') wrap('\n```mermaid\n', '\n```\n', '');
          else if (act === 'link') wrap('[', '](https://)', '링크');
          else if (act === 'image') wrap('![', '](https://)', 'alt');
        });
      });
      area.addEventListener('keydown', function (e) {
        if (e.key === 'Tab') { e.preventDefault(); insertText('  '); }   // undo 보존
      });

      function insertAtCursor(text) { insertText(text); render(); }
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
        var cat = (cEl && cEl.value || '').trim();
        var subEl = $('#ed-subcat'); var sub = (subEl && subEl.value || '').trim();
        if (!cat) return 'Blog';
        return sub ? (cat + '/' + sub) : cat;   // 세부 선택 시 부모/세부, 아니면 부모만
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
        var _d = new Date(), _p = function (n) { return (n < 10 ? '0' : '') + n; };
        var _stamp = _d.getFullYear() + '.' + _p(_d.getMonth() + 1) + '.' + _p(_d.getDate()) + ' ' + _p(_d.getHours()) + ':' + _p(_d.getMinutes());
        var verifyPost = function (html) { var mk = editingUrl ? _stamp : doc.title; return !mk || html.indexOf(mk) > -1; };
        var oldPath = editingUrl ? urlToPath(editingUrl) : '';
        var fname = oldPath ? oldPath.split('/').pop() : (today() + '-' + doc.slug + '.md');
        var path = '_pages/' + catFolder() + '/' + fname;
        var moved = !!editingUrl && oldPath !== path;   // 수정 중 카테고리 바꿈 → 글 이동
        var conf = ghConf(), token = ghToken();
        if (token && conf.repo) {
          pub.disabled = true;
          showPub('커밋 중…', moved ? '카테고리 이동 중…' : 'GitHub에 글을 올리고 있어요');
          githubPutFile(conf, token, path, doc.content, (editingUrl ? 'edit: ' : 'post: ') + doc.title)
            .then(function (res) {
              localStorage.removeItem('hg-edit');
              var sha = (res && res.commit && res.commit.sha) || '';
              var done = function () {
                updatePub('배포 중…', '빌드되면 자동으로 글로 이동해요 (보통 1~2분)');
                pollDeploy(sha, pathToUrl(path), verifyPost);
              };
              if (moved) {   // 옛 위치 파일 삭제(이동 완성)
                window.__ghGetFile(conf, token, oldPath)
                  .then(function (g) { return window.__ghDeleteFile(conf, token, oldPath, g.sha, 'move post: ' + oldPath + ' → ' + path); })
                  .then(function (r) { if (r && r.commit && r.commit.sha) sha = r.commit.sha; done(); })
                  .catch(function () { done(); });   // 삭제 실패해도 새 위치엔 저장됨
              } else done();
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
