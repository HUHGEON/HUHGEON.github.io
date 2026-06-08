/* ============================================================
   HUHGEON's Blog — app logic (Jekyll data-driven, vanilla)
   window.POSTS / window.CAT_NODES / window.SITE 를 소비한다.
   ============================================================ */
(function () {
  'use strict';

  var POSTS = window.POSTS || [];
  // 등록일(date) 내림차순 정렬 — "2026.06.08" 형식이라 문자열 비교로 정확히 정렬됨
  POSTS.sort(function (a, b) { return (a.date < b.date) ? 1 : (a.date > b.date) ? -1 : 0; });
  var CAT_NODES = window.CAT_NODES || [];
  var SITE = window.SITE || { baseurl: '', profile: 'assets/img/me.jpg', defaultThumb: 'assets/img/me.jpg' };
  var BASE = SITE.baseurl || '';
  var DEFAULT_THUMB = SITE.defaultThumb || (BASE + '/assets/img/me.jpg');

  var TKEY = 'hg-theme';

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }

  /* ---------- Theme ---------- */
  function applyTheme(t) { document.body.classList.toggle('light', t === 'light'); }

  /* ---------- GitHub 로그인 / 로그아웃 (상단바) ---------- */
  var GH_ICON = '<svg viewBox="0 0 496 512"><path d="M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3 .3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5 .3-6.2 2.3zm44.2-1.7c-2.9 .7-4.9 2.6-4.6 4.9 .3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8z"></path></svg>';
  function authConf() { var c = window.AUTH || {}; return { oauthUrl: (c.oauthUrl || '').replace(/\/$/, ''), ownerLogin: (c.ownerLogin || '').trim() }; }
  function ghToken() { return localStorage.getItem('hg-gh-token') || ''; }
  function ghUser() { return localStorage.getItem('hg-gh-user') || ''; }
  function isOwnerLoggedIn() { var a = authConf(); return !!ghToken() && !!ghUser() && (!a.ownerLogin || ghUser() === a.ownerLogin); }
  function loginGitHub() {
    var a = authConf();
    if (!a.oauthUrl) { location.href = BASE + '/admin.html'; return; }
    var win = window.open(a.oauthUrl + '/auth', 'gh_login', 'width=640,height=760');
    var wo; try { wo = new URL(a.oauthUrl).origin; } catch (e) { wo = '*'; }
    function onMsg(e) {
      if (wo !== '*' && e.origin !== wo) return;
      var d = e.data; if (!d || d.type !== 'gh-oauth') return;
      window.removeEventListener('message', onMsg);
      if (d.error || !d.token) { showToast('로그인 실패: ' + (d.error || '토큰 없음')); return; }
      fetch('https://api.github.com/user', { headers: { 'Authorization': 'Bearer ' + d.token, 'Accept': 'application/vnd.github+json' } })
        .then(function (r) { return r.json(); })
        .then(function (u) {
          // 누구나 로그인 저장 → 댓글 작성 가능. 오너(저장소 주인)면 관리자 기능까지 자동 부여.
          localStorage.setItem('hg-gh-token', d.token); localStorage.setItem('hg-gh-user', u.login); location.reload();
        })
        .catch(function (err) { showToast('로그인 실패: ' + err.message); });
    }
    window.addEventListener('message', onMsg);
  }
  function logoutGitHub() { localStorage.removeItem('hg-gh-token'); localStorage.removeItem('hg-gh-user'); location.reload(); }
  function urlToPath(url) {
    var u = String(url || '').replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '');
    try { u = decodeURIComponent(u); } catch (e) {}
    return '_pages/' + u.replace(/\.html$/, '.md');
  }
  function ghDeleteFile(path, message) {
    var au = window.AUTH || {};
    var repo = (au.repo || '').trim(), branch = (au.branch || 'main').trim(), token = ghToken();
    if (!repo || !token) return Promise.reject(new Error('로그인 필요'));
    var api = 'https://api.github.com/repos/' + repo + '/contents/' + path.split('/').map(encodeURIComponent).join('/');
    var headers = { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json' };
    return fetch(api + '?ref=' + encodeURIComponent(branch), { headers: headers })
      .then(function (r) { if (!r.ok) throw new Error('GET ' + r.status); return r.json(); })
      .then(function (j) { return fetch(api, { method: 'DELETE', headers: headers, body: JSON.stringify({ message: message, sha: j.sha, branch: branch }) }); })
      .then(function (r) { if (r.status === 200) return r.json(); return r.json().then(function (e) { throw new Error(e.message || ('DELETE ' + r.status)); }); });
  }
  function goToComments() {
    var c = document.querySelector('#giscus') || document.querySelector('.comments');
    if (c) { c.scrollIntoView({ behavior: 'smooth' }); showToast('댓글창에서 GitHub로 로그인하면 댓글을 남길 수 있어요'); }
    else { showToast('글을 열면 맨 아래 댓글창에서 GitHub로 로그인해 댓글을 남길 수 있어요'); }
  }
  function isLoggedIn() { return !!ghToken() && !!ghUser(); }
  function renderAuthBtn() {
    var wrap = $('#tb-auth-wrap'), b = $('#tb-auth'); if (!b) return;
    if (isLoggedIn()) {
      var label = isOwnerLoggedIn() ? '로그아웃' : '로그아웃';
      b.innerHTML = GH_ICON + '<span>' + label + '</span>';
      b.title = '@' + ghUser() + (isOwnerLoggedIn() ? ' (관리자)' : '') + ' · 로그아웃';
      b.classList.add('on');
      b.onclick = logoutGitHub;
    } else {
      b.innerHTML = GH_ICON + '<span>GitHub 로그인</span>';
      b.title = 'GitHub로 로그인 (글쓰기·댓글)';
      b.classList.remove('on');
      b.onclick = loginGitHub;
    }
    if (wrap) wrap.hidden = false;
  }
  window.__login = loginGitHub; window.__logout = logoutGitHub;

  /* ---------- popular tags ---------- */
  function tagCounts() {
    var m = {};
    POSTS.forEach(function (p) { (p.tags || []).forEach(function (t) { m[t] = (m[t] || 0) + 1; }); });
    return Object.keys(m).map(function (k) { return { tag: k, n: m[k] }; })
      .sort(function (a, b) { return b.n - a.n; });
  }

  function pad2(i) { return (i < 10 ? '0' : '') + i; }

  function thumbHtml(p, cls) {
    cls = cls || 'row-thumb';
    if (!p.thumb) return '<div class="' + cls + ' empty"></div>';
    return '<div class="' + cls + '" style="background-image:url(\'' + escAttr(p.thumb) + '\')"></div>';
  }

  function catLabel(p) { return p.cat + (p.sub ? ' · ' + p.sub : ''); }

  /* ---------- post row markup (links to real url) ---------- */
  function rowMarkup(p, idx) {
    var tags = (p.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('');
    return '<article class="row" data-url="' + escAttr(p.url) + '">' +
      '<div class="row-idx">' + pad2(idx) + '</div>' +
      '<div class="row-body">' +
        '<div class="row-top"><div class="row-cat">' + esc(catLabel(p)) + '</div>' +
        '<span class="tags">' + tags + '</span></div>' +
        '<h4>' + esc(p.title) + '</h4>' +
        '<p>' + esc(p.excerpt) + '</p>' +
        '<div class="row-meta"><span>' + esc(p.date) + '</span></div>' +
      '</div>' + thumbHtml(p) + '</article>';
  }

  function heroMarkup(p) {
    var bg = p.thumb || DEFAULT_THUMB;
    return '<article class="hero" data-url="' + escAttr(p.url) + '">' +
      '<div class="bg" style="background-image:url(\'' + escAttr(bg) + '\')"></div>' +
      '<div class="inner">' +
        '<span class="kicker"><svg viewBox="0 0 576 512"><path d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.6 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L421.2 329 535.3 217.6c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L373.1 150.3 316.9 18z"></path></svg> FEATURED</span>' +
        '<h2>' + esc(p.title) + '</h2>' +
        '<p>' + esc(p.excerpt) + '</p>' +
        '<div class="meta"><span>' + esc(catLabel(p)) + '</span><span class="dotsep">·</span><span>' + esc(p.date) + '</span></div>' +
      '</div></article>';
  }

  /* ---------- owner row actions ---------- */
  var PENCIL = '<svg viewBox="0 0 512 512"><path d="M362.7 19.3L314.3 67.7 444.3 197.7l48.4-48.4c25-25 25-65.5 0-90.5L453.3 19.3c-25-25-65.5-25-90.5 0zm-71 71L58.6 323.5c-10.4 10.4-18 23.3-22.2 37.4L1 481.2C-1.5 489.7 .8 498.8 7 505s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L421.7 220.3 291.7 90.3z"/></svg>';
  var TRASH = '<svg viewBox="0 0 448 512"><path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"/></svg>';
  function decorateRows(root) {
    $$('.row', root).forEach(function (r) {
      if (r.querySelector('.row-actions')) return;
      var a = document.createElement('div'); a.className = 'row-actions';
      a.innerHTML = '<button class="row-act edit" data-rowedit="1" title="수정">' + PENCIL + '</button>' +
                    '<button class="row-act del" data-rowdel="1" title="삭제">' + TRASH + '</button>';
      r.appendChild(a);
    });
  }

  /* ---------- edit handoff: 글 원문을 에디터로 넘김 ---------- */
  function findPostByUrl(url) {
    if (!url) return null;
    for (var i = 0; i < POSTS.length; i++) { if (POSTS[i].url === url) return POSTS[i]; }
    // 인코딩 차이 대비
    try { var d = decodeURIComponent(url); for (var j = 0; j < POSTS.length; j++) { if (decodeURIComponent(POSTS[j].url) === d) return POSTS[j]; } } catch (e) {}
    return null;
  }
  function editPost(post) {
    if (!post) { location.href = BASE + '/admin.html#write'; return; }
    var draft = {
      title: post.title || '',
      cat: post.cat || '', sub: post.sub || '',
      tags: (post.tags || []).join(', '),
      body: post.body || '',
      url: post.url || '',
      date: post.date || ''        // 최초 등록일(예: "2026.06.08") — 수정 시 유지용
    };
    try { localStorage.setItem('hg-edit', JSON.stringify(draft)); } catch (e) {}
    location.href = BASE + '/admin.html#edit';
  }

  /* ---------- toast ---------- */
  var toastTimer;
  function showToast(msg) {
    var el = $('#toast'), m = $('#toast-msg'); if (!el) return;
    if (m) m.textContent = msg;
    el.classList.add('show'); clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  /* ============================================================
     Sidebar: category tree + popular tags + counts
     ============================================================ */
  function catCount(cat) { return POSTS.filter(function (p) { return p.cat === cat; }).length; }
  function subCount(cat, sub) { return POSTS.filter(function (p) { return p.cat === cat && p.sub === sub; }).length; }

  function buildCatTree() {
    // group CAT_NODES into { cat: {url, subs:[{name,url}]} }
    var order = [], map = {};
    CAT_NODES.forEach(function (n) {
      if (!map[n.cat]) { map[n.cat] = { name: n.cat, url: '', subs: [] }; order.push(n.cat); }
      if (!n.sub) { map[n.cat].url = n.url; }
      else { map[n.cat].subs.push({ name: n.sub, url: n.url }); }
    });
    // posts may reference cats with no index.md — include them too
    POSTS.forEach(function (p) {
      if (!map[p.cat]) { map[p.cat] = { name: p.cat, url: BASE + '/', subs: [] }; order.push(p.cat); }
      if (p.sub && !map[p.cat].subs.some(function (s) { return s.name === p.sub; })) {
        map[p.cat].subs.push({ name: p.sub, url: '' });
      }
    });
    return order.map(function (c) { return map[c]; });
  }

  function renderSidebar() {
    var navCats = $('#nav-cats');
    if (navCats) {
      var tree = buildCatTree();
      navCats.innerHTML = tree.map(function (c) {
        var hasKids = c.subs.length > 0;
        var url = c.url || (BASE + '/');
        var row = '<div class="nav-item cat-row" data-cat="' + escAttr(c.name) + '" data-url="' + escAttr(url) + '">' +
          '<span class="ico"><svg viewBox="0 0 24 24"><path d="M3 7l2-2h5l2 2h7a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V7z"></path></svg></span>' +
          '<span class="nav-name">' + esc(c.name) + '</span>' +
          (hasKids ? '<button class="nav-exp" aria-label="펼치기"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"></path></svg></button>' : '') +
          '<span class="badge">' + catCount(c.name) + '</span></div>';
        var subs = hasKids ? '<div class="nav-children">' + c.subs.map(function (ch, i) {
          var u = ch.url || (BASE + '/');
          return '<a class="nav-item sub' + (i === c.subs.length - 1 ? ' last' : '') + '" href="' + escAttr(u) + '" data-cat="' + escAttr(c.name) + '" data-sub="' + escAttr(ch.name) + '">' +
            esc(ch.name) + '<span class="badge">' + subCount(c.name, ch.name) + '</span></a>';
        }).join('') + '</div>' : '';
        return '<div class="nav-cat" data-cid="' + escAttr(c.name) + '">' + row + subs + '</div>';
      }).join('');
    }

    var navTags = $('#nav-tags');
    if (navTags) {
      navTags.innerHTML = tagCounts().slice(0, 8).map(function (t) {
        return '<a class="tag" href="' + BASE + '/#tag=' + encodeURIComponent(t.tag) + '">' + esc(t.tag) + '</a>';
      }).join('');
    }

    var allCount = $('#all-count'); if (allCount) allCount.textContent = POSTS.length;
  }

  /* sidebar interactions: expand chevron + category navigate */
  function bindSidebar() {
    var navCats = $('#nav-cats');
    if (navCats) navCats.addEventListener('click', function (e) {
      var exp = e.target.closest('.nav-exp');
      if (exp) {
        e.preventDefault(); e.stopPropagation();
        var wrap = exp.closest('.nav-cat'); if (wrap) wrap.classList.toggle('open');
        return;
      }
      var catRow = e.target.closest('.cat-row');
      if (catRow) {
        var url = catRow.getAttribute('data-url');
        if (url) location.href = url;
      }
    });
  }

  /* mark active nav based on current page */
  function markActiveNav() {
    var vh = $('#view-home');
    if (!vh) return;
    var cat = vh.getAttribute('data-cat'), sub = vh.getAttribute('data-sub');
    var hash = location.hash || '';
    $$('.nav-item').forEach(function (n) { n.classList.remove('active'); });
    if (cat) {
      // open + activate the matching category
      $$('#nav-cats .nav-cat').forEach(function (w) {
        if (w.getAttribute('data-cid') === cat) {
          w.classList.add('open');
          var cr = w.querySelector('.cat-row'); if (cr && !sub) cr.classList.add('active');
          if (sub) { var s = w.querySelector('.nav-item.sub[data-sub="' + cssEsc(sub) + '"]'); if (s) s.classList.add('active'); }
        }
      });
    } else if (/^#all/.test(hash)) {
      var nap = $('#nav-all-posts'); if (nap) nap.classList.add('active');
    } else {
      var nr = $('#nav-recent'); if (nr) nr.classList.add('active');
    }
  }
  function cssEsc(s) { return String(s).replace(/"/g, '\\"'); }
  function setCrumb(html) { var c = $('#crumb'); if (c) c.innerHTML = html; }

  /* ============================================================
     HOME / category / full-list / tag views
     ============================================================ */
  var PER = 6;
  var currentSort = 'date';   // 'date'(최신순) | 'views'(조회수순) — 카테고리/전체글에서만
  var viewCounts = {};        // { url: 조회수 } 캐시
  function sortedList(list) {
    if (currentSort !== 'views') return list;   // 기본은 등록일 내림차순(이미 정렬됨)
    return list.slice().sort(function (a, b) { return (viewCounts[b.url] || 0) - (viewCounts[a.url] || 0); });
  }
  function sortToggle() {
    return '<div class="sort-opts"><span class="so-lbl">정렬</span>' +
      '<button class="sort-opt' + (currentSort === 'date' ? ' on' : '') + '" data-sort="date">최신순</button>' +
      '<button class="sort-opt' + (currentSort === 'views' ? ' on' : '') + '" data-sort="views">조회수순</button></div>';
  }
  function ensureViewCounts(cb) {
    var ou = ((window.AUTH || {}).oauthUrl || '').replace(/\/$/, '');
    var todo = POSTS.filter(function (p) { return viewCounts[p.url] == null; });
    if (!ou || !todo.length) { cb(); return; }
    var pending = todo.length;
    todo.forEach(function (p) {
      fetch(ou + '/views?path=' + encodeURIComponent(p.url))   // 읽기 전용(쓰기 X)
        .then(function (r) { return r.json(); })
        .then(function (j) { viewCounts[p.url] = (j && j.count) || 0; })
        .catch(function () { viewCounts[p.url] = 0; })
        .then(function () { if (--pending === 0) cb(); });
    });
  }

  function featuredPost() {
    var marked = POSTS.filter(function (p) { return p.bookmark; });
    if (marked.length) return marked[0]; // POSTS already date-desc
    return POSTS[0];
  }

  function renderHome(root) {
    var feat = featuredPost();
    var rest = POSTS.filter(function (p) { return p.url !== (feat ? feat.url : null); });
    var tags = tagCounts().slice(0, 5);
    var chips = '<button class="chip on" data-tag="">all</button>' +
      tags.map(function (t) { return '<button class="chip" data-tag="' + escAttr(t.tag) + '">' + esc(t.tag) + '</button>'; }).join('');
    root.innerHTML =
      '<div class="home-head">' +
        '<div class="cmd"><b>$</b> ls -la ~/posts <span class="flag">--sort=date</span></div>' +
        '<h1>최신글</h1>' +
        '<p class="sub">최근 올라온 글 — 전체 ' + POSTS.length + '개는 ‘전체글’에서 볼 수 있어요</p>' +
      '</div>' +
      (feat ? heroMarkup(feat) : '') +
      '<div class="filters">' + chips + '</div>' +
      '<div class="sec-head"><h3>최근 글</h3><span class="n">' + POSTS.length + ' posts</span>' +
        '<a class="more" href="' + BASE + '/#all" id="see-all">모두 보기 →</a></div>' +
      '<div class="rows" id="rows">' + rest.map(function (p, k) { return rowMarkup(p, k + 1); }).join('') + '</div>';
    decorateRows(root);
  }

  function renderFiltered(root, cat, sub) {
    var list = POSTS.filter(function (p) { return p.cat === cat && (!sub || p.sub === sub); });
    var label = sub || cat;
    // 터미널 경로의 각 카테고리를 클릭 가능하게 (부모/자식 → 해당 목록으로)
    var catUrl = BASE + '/' + encodeURIComponent(cat) + '/';
    var pathHtml = '<a href="' + catUrl + '">' + esc(cat.replace(/\s+/g, '-')) + '</a>' +
      (sub ? '/<a href="' + BASE + '/' + encodeURIComponent(cat) + '/' + encodeURIComponent(sub) + '/">' + esc(sub.replace(/\s+/g, '-')) + '</a>' : '');
    root.innerHTML =
      '<div class="cat-header">' +
        '<button class="cat-back" data-home="1">← 전체 글</button>' +
        '<div class="cat-h-cmd"><b>$</b> ls ~/' + pathHtml + '</div>' +
        (sub ? '<div class="cat-crumb"><a href="' + catUrl + '">' + esc(cat) + '</a> <span class="catsep">·</span> ' + esc(sub) + '</div>' : '') +
        '<h1>' + esc(label) + '</h1><p class="sub">' + list.length + '개의 글</p>' +
        (list.length === 0 ? '<div class="cat-empty">아직 이 카테고리에 글이 없어요 — 새 글 쓰기로 첫 글을 남겨보세요.</div>' : '') +
      '</div>' +
      (list.length > 1 ? sortToggle() : '') +
      '<div class="rows" id="rows">' + sortedList(list).map(function (p, k) { return rowMarkup(p, k + 1); }).join('') + '</div>';
    decorateRows(root);
  }

  function renderTag(root, tag) {
    var list = POSTS.filter(function (p) { return (p.tags || []).indexOf(tag) > -1; });
    root.innerHTML =
      '<div class="all-head">' +
        '<button class="cat-back" data-home="1">← 최근 글</button>' +
        '<div class="cat-h-cmd"><b>$</b> grep -l <span style="color:var(--c-tag)">#' + esc(tag) + '</span> ~/posts</div>' +
        '<h1>#' + esc(tag) + '</h1><p class="sub">' + list.length + '개의 글</p>' +
        (list.length === 0 ? '<div class="cat-empty">이 태그의 글이 아직 없어요.</div>' : '') +
      '</div>' +
      '<div class="rows" id="rows">' + list.map(function (p, k) { return rowMarkup(p, k + 1); }).join('') + '</div>';
    decorateRows(root);
  }

  function renderAll(root, page) {
    var all = sortedList(POSTS);
    var pages = Math.max(1, Math.ceil(all.length / PER));
    page = Math.max(1, Math.min(page || 1, pages));
    var start = (page - 1) * PER, slice = all.slice(start, start + PER);
    var pager = '';
    for (var i = 1; i <= pages; i++) pager += '<button class="pg-num' + (i === page ? ' on' : '') + '" data-pg="' + i + '">' + i + '</button>';
    root.innerHTML =
      '<div class="all-head"><button class="cat-back" data-home="1">← 최근 글</button>' +
        '<div class="cat-h-cmd"><b>$</b> ls -la ~/posts <span style="color:var(--faint)">| wc -l → ' + POSTS.length + '</span></div>' +
        '<h1>전체 글</h1><p class="sub">총 ' + POSTS.length + '개 · ' + page + ' / ' + pages + ' 페이지</p></div>' +
      (all.length > 1 ? sortToggle() : '') +
      '<div class="rows all-rows" id="rows">' + slice.map(function (p, k) { return rowMarkup(p, start + k + 1); }).join('') + '</div>' +
      '<div class="pagination">' +
        '<button class="pg-arrow" data-pg="' + (page - 1) + '"' + (page === 1 ? ' disabled' : '') + '>← 이전</button>' + pager +
        '<button class="pg-arrow" data-pg="' + (page + 1) + '"' + (page === pages ? ' disabled' : '') + '>다음 →</button></div>';
    decorateRows(root);
  }

  function routeHome() {
    var vh = $('#view-home'); if (!vh) return;
    var root = $('#home-content'); if (!root) return;
    var cat = vh.getAttribute('data-cat'), sub = vh.getAttribute('data-sub');
    var hash = location.hash || '';
    var mTag = hash.match(/^#tag=(.+)$/);
    var mAll = hash.match(/^#all(?:\/(\d+))?$/);
    var blog = '<a href="' + BASE + '/">Blog</a><span class="sep">/</span>';
    if (cat) {
      renderFiltered(root, cat, sub);
      if (sub) setCrumb(blog + '<a href="' + BASE + '/' + encodeURIComponent(cat) + '/">' + esc(cat) + '</a><span class="sep">/</span><span class="cur">' + esc(sub) + '</span>');
      else setCrumb(blog + '<span class="cur">' + esc(cat) + '</span>');
    }
    else if (mTag) { var tg = decodeURIComponent(mTag[1]); renderTag(root, tg); setCrumb(blog + '<span class="cur">#' + esc(tg) + '</span>'); }
    else if (mAll) { renderAll(root, mAll[1] ? +mAll[1] : 1); setCrumb(blog + '<span class="cur">전체 글</span>'); }
    else { renderHome(root); setCrumb(blog + '<span class="cur">최신글</span>'); }
    window.scrollTo(0, 0);
    markActiveNav();
  }

  /* home view delegated interactions */
  function bindHome() {
    var vh = $('#view-home'); if (!vh) return;

    // row navigation (ignore owner actions)
    vh.addEventListener('click', function (e) {
      if (e.target.closest('[data-rowdel]')) {
        e.preventDefault();
        var drow = e.target.closest('.row');
        var dp = findPostByUrl(drow && drow.getAttribute('data-url'));
        if (!isOwnerLoggedIn()) { showToast('관리자로 로그인해야 삭제할 수 있어요'); return; }
        if (!dp) return;
        if (!confirm('“' + dp.title + '” 글을 삭제할까요? GitHub에서 파일이 삭제됩니다.')) return;
        showToast('삭제 중…');
        ghDeleteFile(urlToPath(dp.url), 'delete: ' + dp.title)
          .then(function () { if (drow) drow.remove(); showToast('삭제됐어요 — 곧 반영됩니다'); })
          .catch(function (ex) { showToast('삭제 실패: ' + ex.message); });
        return;
      }
      if (e.target.closest('[data-rowedit]')) {
        e.preventDefault();
        var er = e.target.closest('.row');
        editPost(findPostByUrl(er && er.getAttribute('data-url')));
        return;
      }
      var row = e.target.closest('.row[data-url]');
      if (row) { location.href = row.getAttribute('data-url'); return; }
      var hero = e.target.closest('.hero[data-url]');
      if (hero) { location.href = hero.getAttribute('data-url'); return; }

      var back = e.target.closest('[data-home]');
      if (back) { e.preventDefault();
        if (vh.getAttribute('data-cat')) { location.href = BASE + '/'; }
        else { history.pushState(null, '', BASE + '/'); routeHome(); }
        return; }

      var pg = e.target.closest('.pagination [data-pg]');
      if (pg && !pg.disabled) { var n = +pg.getAttribute('data-pg'); history.replaceState(null, '', BASE + '/#all' + (n > 1 ? '/' + n : '')); routeHome(); return; }

      var see = e.target.closest('#see-all, #nav-all-posts');
      if (see) { e.preventDefault(); history.pushState(null, '', BASE + '/#all'); routeHome(); return; }

      var so = e.target.closest('.sort-opt');
      if (so) {
        var s = so.getAttribute('data-sort');
        if (s === currentSort) return;
        currentSort = s;
        if (s === 'views') { showToast('조회수 불러오는 중…'); ensureViewCounts(function () { routeHome(); }); }
        else routeHome();
        return;
      }

      var chip = e.target.closest('.filters .chip');
      if (chip) {
        $$('.filters .chip', vh).forEach(function (c) { c.classList.remove('on'); });
        chip.classList.add('on');
        var tag = chip.getAttribute('data-tag');
        $$('#rows .row', vh).forEach(function (r) {
          if (!tag) { r.style.display = ''; return; }
          var has = $$('.row-meta .tag, .row-top .tag', r).some(function (t) { return t.textContent.trim() === tag; });
          r.style.display = has ? '' : 'none';
        });
        return;
      }
    });

    window.addEventListener('hashchange', routeHome);
  }

  /* ============================================================
     Topbar inline search (from POSTS)
     ============================================================ */
  function bindSearch() {
    var sInput = $('#tb-search-input'), sResults = $('#tb-search-results');
    if (!sInput || !sResults) return;
    function render(q) {
      q = (q || '').trim().toLowerCase();
      var listed = q ? POSTS.filter(function (p) {
        return (p.title + ' ' + (p.tags || []).join(' ') + ' ' + p.cat + ' ' + p.sub + ' ' + (p.excerpt || '')).toLowerCase().indexOf(q) > -1;
      }) : POSTS;
      if (!listed.length) { sResults.innerHTML = '<div class="search-empty">검색 결과가 없어요</div>'; return; }
      sResults.innerHTML = listed.slice(0, 8).map(function (p) {
        return '<a class="search-item" href="' + escAttr(p.url) + '">' +
          '<div class="si-main"><div class="si-cat">' + esc(catLabel(p)) + '</div><div class="si-title">' + esc(p.title) + '</div></div>' +
          '<div class="si-tags">' + (p.tags || []).slice(0, 3).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div></a>';
      }).join('');
    }
    function open() { render(sInput.value); sResults.hidden = false; }
    function close() { sResults.hidden = true; }
    sInput.addEventListener('input', open);
    sInput.addEventListener('focus', open);
    document.addEventListener('click', function (e) { if (!e.target.closest('.tb-search-wrap')) close(); });
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); sInput.focus(); open(); }
      else if (e.key === 'Escape') { close(); sInput.blur(); }
    });
  }

  /* ============================================================
     POST page: like / codeblocks / TOC / related / giscus
     ============================================================ */
  /* ---------- Mermaid 다이어그램 ---------- */
  function renderMermaid() {
    if (!window.mermaid) return;
    try {
      window.mermaid.initialize({ startOnLoad: false, securityLevel: 'loose',
        theme: document.body.classList.contains('light') ? 'neutral' : 'dark' });
      window.mermaid.run({ querySelector: '.mermaid' });
    } catch (e) {}
  }
  var mermaidLoading = false;
  function loadMermaid() {
    if (window.mermaid) { renderMermaid(); return; }
    if (mermaidLoading) return;
    mermaidLoading = true;
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
    s.onload = renderMermaid;
    s.onerror = function () { mermaidLoading = false; };
    document.head.appendChild(s);
  }

  function initPost() {
    var vp = $('#view-post'); if (!vp) return;
    var isDoc = vp.classList.contains('doc-page');

    /* mermaid 코드블럭 먼저: ```mermaid → 다이어그램 div 로 교체 */
    var mermaidBlocks = [];
    $$('.prose pre').forEach(function (pre) {
      var code = pre.querySelector('code');
      var ml = code ? ((code.className || '').match(/language-(mermaid)/) || [])[1] : null;
      if (ml === 'mermaid') {
        var div = document.createElement('div'); div.className = 'mermaid';
        div.textContent = (code ? code.textContent : pre.textContent);
        pre.parentNode.replaceChild(div, pre);
        mermaidBlocks.push(div);
      }
    });
    if (mermaidBlocks.length) loadMermaid();

    /* code blocks: highlight + wrap traffic-light header + copy (모든 글/문서) */
    if (window.hljs) { try { hljs.highlightAll(); } catch (e) {} }
    $$('.prose pre').forEach(function (pre) {
      if (pre.closest('.codeblock')) return;
      var code = pre.querySelector('code');
      var lang = 'code';
      if (code) { var m = (code.className || '').match(/language-([\w-]+)/); if (m) lang = m[1]; }
      var wrap = document.createElement('div'); wrap.className = 'codeblock';
      var head = document.createElement('div'); head.className = 'cb-head';
      head.innerHTML = '<span class="d" style="background:#cf8a93"></span><span class="d" style="background:#c2a06a"></span><span class="d" style="background:#86ad8e"></span>' +
        '<span class="lang">' + esc(lang) + '</span>' +
        '<button class="copy"><svg viewBox="0 0 384 512"><path d="M192 0c-41.8 0-77.4 26.7-90.5 64H64C28.7 64 0 92.7 0 128V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V128c0-35.3-28.7-64-64-64H282.5C269.4 26.7 233.8 0 192 0zm0 64a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"></path></svg><span class="cl">Copy</span></button>';
      pre.parentNode.insertBefore(wrap, pre);
      wrap.appendChild(head); wrap.appendChild(pre);
    });
    document.addEventListener('click', function (e) {
      var cp = e.target.closest('.copy'); if (!cp) return;
      var pre = cp.closest('.codeblock').querySelector('pre');
      var code = pre.querySelector('code') || pre;
      if (navigator.clipboard) navigator.clipboard.writeText(code.innerText);
      var t = cp.querySelector('.cl'); if (t) { var o = t.textContent; t.textContent = 'Copied'; setTimeout(function () { t.textContent = o; }, 1200); }
    });

    if (isDoc) return;
    var cat = vp.getAttribute('data-cat'), title = vp.getAttribute('data-title');

    /* like */
    var likeBtn = $('#like-btn');
    if (likeBtn) {
      var lkey = 'hg-liked:' + location.pathname;   // 내가 눌렀는지(UI 상태)
      var likeCount = $('#like-count'), byl = $('#byline-likes');
      var likeOu = ((window.AUTH || {}).oauthUrl || '').replace(/\/$/, '');
      var liked = localStorage.getItem(lkey) === '1';
      var serverCount = null;
      function paintLike() {
        likeBtn.classList.toggle('on', liked);
        likeBtn.setAttribute('aria-pressed', liked ? 'true' : 'false');
        var v = (serverCount != null) ? serverCount : (liked ? 1 : 0);
        if (likeCount) likeCount.textContent = v;
        if (byl) byl.textContent = v;
      }
      paintLike();
      if (likeOu) {
        fetch(likeOu + '/like?path=' + encodeURIComponent(location.pathname))
          .then(function (r) { return r.json(); })
          .then(function (j) { if (j && j.count != null) { serverCount = j.count; paintLike(); } })
          .catch(function () {});
      }
      var likeBusy = false;
      likeBtn.addEventListener('click', function () {
        if (likeBusy) return;
        if (!likeOu) { liked = !liked; localStorage.setItem(lkey, liked ? '1' : '0'); paintLike(); return; }
        if (!isLoggedIn()) { showToast('좋아요는 로그인 후에 누를 수 있어요'); loginGitHub(); return; }
        likeBusy = true; likeBtn.classList.add('busy');
        fetch(likeOu + '/like?path=' + encodeURIComponent(location.pathname), { method: 'POST', headers: { 'Authorization': 'Bearer ' + ghToken() } })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            if (j && j.count != null) { serverCount = j.count; liked = !!j.liked; localStorage.setItem(lkey, liked ? '1' : '0'); paintLike(); }
            else if (j && j.error) showToast('좋아요 실패: ' + (j.message || j.error));
          })
          .catch(function () {})
          .then(function () { likeBusy = false; likeBtn.classList.remove('busy'); });
      });
    }

    /* edit → 에디터로 글 원문 넘기기 */
    var editBtn = $('#post-edit-btn');
    if (editBtn) editBtn.addEventListener('click', function (e) {
      e.preventDefault();
      editPost(findPostByUrl(vp.getAttribute('data-url')));
    });

    /* delete → GitHub에서 글 파일 삭제 (관리자만) */
    var del = $('#post-del-btn');
    if (del) del.addEventListener('click', function () {
      if (!isOwnerLoggedIn()) { showToast('관리자로 로그인해야 삭제할 수 있어요'); return; }
      if (!confirm('이 글을 삭제할까요?\nGitHub에서 파일이 삭제되고 사이트에서 사라집니다.')) return;
      showToast('삭제 중…');
      ghDeleteFile(urlToPath(vp.getAttribute('data-url')), 'delete: ' + (vp.getAttribute('data-title') || ''))
        .then(function () { showToast('삭제됐어요 — 곧 사이트에 반영됩니다'); setTimeout(function () { location.href = BASE + '/'; }, 1300); })
        .catch(function (e) { showToast('삭제 실패: ' + e.message); });
    });

    /* TOC from headings */
    var tocLinks = $('#toc-links'), toc = $('#toc');
    var heads = $$('.prose h2, .prose h1');
    if (tocLinks && heads.length) {
      heads.forEach(function (h, i) {
        if (!h.id) h.id = 's-' + i;
      });
      tocLinks.innerHTML = heads.map(function (h, i) {
        return '<a href="#' + h.id + '"' + (i === 0 ? ' class="active"' : '') + '>' + esc(h.textContent.replace(/^##\s*/, '')) + '</a>';
      }).join('');
      var links = $$('a', tocLinks);
      var secs = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
      window.addEventListener('scroll', function () {
        var y = window.scrollY + 130, idx = 0;
        secs.forEach(function (s, i) { if (s && s.offsetTop <= y) idx = i; });
        links.forEach(function (a, i) { a.classList.toggle('active', i === idx); });
      }, { passive: true });
    } else if (toc) { toc.style.display = 'none'; }

    /* related: same category first */
    var relGrid = $('#rel-grid'), relBox = $('#related');
    if (relGrid) {
      var rel = POSTS.filter(function (p) { return p.cat === cat && p.title !== title; });
      POSTS.forEach(function (p) { if (rel.length < 2 && p.title !== title && rel.indexOf(p) === -1) rel.push(p); });
      rel = rel.slice(0, 2);
      if (rel.length) {
        relGrid.innerHTML = rel.map(function (p) {
          return '<a class="card" href="' + escAttr(p.url) + '">' + thumbHtml(p, 'thumb') +
            '<div class="body"><div class="cat">' + esc(catLabel(p)) + '</div><h4>' + esc(p.title) + '</h4></div></a>';
        }).join('');
        if (relBox) relBox.hidden = false;
      }
    }

    /* 조회수: 워커(DO/KV) 우선 — countViews()가 채움. 워커 없으면 goatcounter, 그것도 없으면 숨김 */
    var hits = $('#page-hits'); var viewsWrap = $('.stat-views');
    var hasWorker = !!((window.AUTH || {}).oauthUrl);
    if (hits && !hasWorker && hits.getAttribute('data-gc')) {
      if (viewsWrap) viewsWrap.hidden = false;
      var code = hits.getAttribute('data-gc');
      var gurl = 'https://' + code + '.goatcounter.com/counter/' + encodeURIComponent(location.pathname) + '.json';
      var x = new XMLHttpRequest(); x.open('GET', gurl);
      x.onerror = function () { hits.textContent = '0'; };
      x.onload = function () { try { hits.textContent = JSON.parse(x.responseText).count; } catch (e) { hits.textContent = '0'; } };
      x.send();
    } else if (hits && !hasWorker && viewsWrap) {
      viewsWrap.hidden = true;
    }

    /* 댓글 (커스텀, 워커 KV) */
    initComments();
  }

  /* ============================================================
     댓글 — 통합 로그인(GitHub) 기반, 워커 KV 저장
     본인=수정/삭제, 관리자=전체 삭제, 글당 최대 5개
     ============================================================ */
  function relTime(ts) {
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return '방금';
    var m = Math.floor(s / 60); if (m < 60) return m + '분 전';
    var h = Math.floor(m / 60); if (h < 24) return h + '시간 전';
    var d = Math.floor(h / 24); if (d < 7) return d + '일 전';
    var dt = new Date(ts); return dt.getFullYear() + '.' + (dt.getMonth() + 1) + '.' + dt.getDate();
  }
  function initComments() {
    var root = $('#comments'); if (!root) return;
    var ou = ((window.AUTH || {}).oauthUrl || '').replace(/\/$/, '');
    if (!ou) { var compose0 = $('#comment-compose'); if (compose0) compose0.innerHTML = '<div class="giscus-note">댓글 기능을 쓰려면 <code>_config.yml</code>의 <code>oauth_url</code>(워커)이 필요해요.</div>'; return; }
    var path = encodeURIComponent(location.pathname);
    var list = $('#comment-list'), compose = $('#comment-compose');

    function me() { return ghUser(); }
    function canEdit(c) { return me() && c.login === me(); }
    function canDelete(c) { return me() && (c.login === me() || isOwnerLoggedIn()); }
    function avatar(c) { return '<img class="c-avatar" src="' + escAttr(c.avatar || SITE.profile) + '" alt="">'; }
    function acts(c) {
      return (canEdit(c) ? '<button class="c-act" data-act="edit" data-id="' + c.id + '">수정</button>' : '') +
             (canDelete(c) ? '<button class="c-act c-del" data-act="del" data-id="' + c.id + '">삭제</button>' : '');
    }
    function commentHtml(c, replies) {
      return '<li class="comment" data-id="' + c.id + '">' + avatar(c) + '<div class="c-body">' +
        '<div class="c-meta"><span class="c-name">' + esc(c.name) + '</span><span class="c-time">' + relTime(c.ts) + (c.edited ? ' · 수정됨' : '') + '</span>' +
        '<span class="c-tools">' + acts(c) + '</span></div>' +
        '<div class="c-text">' + esc(c.body) + '</div>' +
        (me() ? '<div class="c-actions"><button class="c-reply" data-act="reply" data-id="' + c.id + '">답글</button></div>' : '') +
        (replies.length ? '<ul class="reply-list">' + replies.map(replyHtml).join('') + '</ul>' : '') +
        '</div></li>';
    }
    function replyHtml(r) {
      return '<li class="comment reply" data-id="' + r.id + '">' + avatar(r) + '<div class="c-body">' +
        '<div class="c-meta"><span class="c-name">' + esc(r.name) + '</span><span class="c-time">' + relTime(r.ts) + (r.edited ? ' · 수정됨' : '') + '</span>' +
        '<span class="c-tools">' + acts(r) + '</span></div>' +
        '<div class="c-text">' + esc(r.body) + '</div></div></li>';
    }
    function setCounts(n) { ['#comment-count', '#comment-count2', '#byline-comments'].forEach(function (s) { var el = $(s); if (el) el.textContent = n; }); }
    function render(items) {
      items = items || [];
      setCounts(items.length);
      var tops = items.filter(function (c) { return !c.parent; });
      var byParent = {}; items.forEach(function (c) { if (c.parent) { (byParent[c.parent] = byParent[c.parent] || []).push(c); } });
      list.innerHTML = tops.length
        ? tops.map(function (c) { return commentHtml(c, byParent[c.id] || []); }).join('')
        : '<li class="c-empty">아직 댓글이 없어요. 첫 댓글을 남겨보세요!</li>';
      // compose: 로그인 상태에 따라 폼 or 로그인 버튼
      if (compose) {
        if (isLoggedIn()) {
          var full = tops.length >= 5;
          compose.innerHTML = full
            ? '<div class="giscus-note">이 글은 댓글 5개가 다 찼어요. (답글은 남길 수 있어요)</div>'
            : '<div class="comment-form"><textarea id="comment-input" placeholder="댓글을 남겨보세요" rows="3"></textarea><div class="comment-form-foot"><span class="cf-hint">@' + esc(me()) + ' 로 작성</span><button class="btn-primary" id="comment-submit">등록</button></div></div>';
        } else {
          compose.innerHTML = '<div class="comment-login"><span>로그인하면 댓글을 남길 수 있어요.</span><button class="btn-primary" id="comment-login-btn">GitHub 로그인</button></div>';
        }
      }
    }

    function authHeaders() { return { 'Authorization': 'Bearer ' + ghToken(), 'Content-Type': 'application/json' }; }
    function handle(r) { return r.json().then(function (j) { if (j && j.error) throw (j.message || j.error); return j; }); }
    function api(method, body, id) {
      var u = ou + '/comments?path=' + path + (id ? '&id=' + id : '');
      var opt = { method: method };
      if (method !== 'GET') opt.headers = authHeaders();
      if (body) opt.body = JSON.stringify(body);
      return fetch(u, opt).then(handle);
    }
    function reload() { api('GET').then(function (j) { render(j.comments); }).catch(function () { render([]); }); }
    reload();

    root.addEventListener('click', function (e) {
      var t = e.target;
      if (t.id === 'comment-login-btn') { loginGitHub(); return; }
      if (t.id === 'comment-submit') {
        var inp = $('#comment-input'); var v = (inp && inp.value || '').trim(); if (!v) return;
        t.disabled = true;
        api('POST', { body: v }).then(function () { reload(); }).catch(function (m) { showToast(m); }).then(function () { t.disabled = false; });
        return;
      }
      var btn = t.closest('[data-act]'); if (!btn) return;
      var id = btn.getAttribute('data-id'), act = btn.getAttribute('data-act');
      var li = btn.closest('.comment');
      if (act === 'del') {
        if (!confirm('이 댓글을 삭제할까요?')) return;
        api('DELETE', null, id).then(reload).catch(showToast);
      } else if (act === 'reply') {
        if (li.querySelector('.c-compose')) return;
        var box = document.createElement('div'); box.className = 'c-compose';
        box.innerHTML = '<textarea placeholder="답글을 입력하세요" rows="2"></textarea><button class="btn-primary">등록</button>';
        li.querySelector('.c-body').appendChild(box);
        box.querySelector('textarea').focus();
        box.querySelector('button').onclick = function () { var v = box.querySelector('textarea').value.trim(); if (!v) return; api('POST', { body: v, parent: id }).then(reload).catch(showToast); };
      } else if (act === 'edit') {
        var textEl = li.querySelector('.c-text'); if (li.querySelector('.c-compose')) return;
        var old = textEl.textContent;
        var ed = document.createElement('div'); ed.className = 'c-compose';
        ed.innerHTML = '<textarea rows="3"></textarea><button class="btn-primary">수정</button>';
        ed.querySelector('textarea').value = old;
        textEl.style.display = 'none'; textEl.parentNode.insertBefore(ed, textEl.nextSibling);
        ed.querySelector('textarea').focus();
        ed.querySelector('button').onclick = function () { var v = ed.querySelector('textarea').value.trim(); if (!v) return; api('PUT', { body: v }, id).then(reload).catch(showToast); };
      }
    });
  }

  /* ============================================================
     Global: theme toggle, mobile drawer, sidebar hits
     ============================================================ */
  function bindGlobal() {
    var themeBtn = $('#theme');
    if (themeBtn) themeBtn.addEventListener('click', function () {
      var now = document.body.classList.contains('light') ? 'dark' : 'light';
      localStorage.setItem(TKEY, now); applyTheme(now);
    });

    var sb = $('#sidebar'), scrim = $('#scrim'), hamb = $('#hamb');
    function closeDrawer() { if (sb) sb.classList.remove('open'); if (scrim) scrim.classList.remove('show'); }
    if (hamb) hamb.addEventListener('click', function () { if (sb) sb.classList.add('open'); if (scrim) scrim.classList.add('show'); });
    if (scrim) scrim.addEventListener('click', closeDrawer);
    // close drawer when navigating via sidebar link on mobile
    if (sb) sb.addEventListener('click', function (e) { if (e.target.closest('a') && window.innerWidth <= 940) setTimeout(closeDrawer, 50); });

    // sidebar 총 방문: 워커 우선(countViews가 처리). 워커 없을 때만 goatcounter total
    var sh = $('#site-hits');
    if (sh && !((window.AUTH || {}).oauthUrl) && sh.getAttribute('data-gc')) {
      var code = sh.getAttribute('data-gc');
      var url = 'https://' + code + '.goatcounter.com/counter/TOTAL.json';
      var x = new XMLHttpRequest(); x.open('GET', url);
      x.onerror = function () {};
      x.onload = function () { try { sh.textContent = JSON.parse(x.responseText).count_unique || JSON.parse(x.responseText).count; } catch (e) {} };
      x.send();
    }
  }

  function fmtNum(n) { return (n != null && n.toLocaleString) ? n.toLocaleString() : n; }
  /* 조회수(글별): 글 상세에서만, 같은 브라우저는 글당 1번만 +1(쓰기). 그 외엔 읽기만. */
  function countViews() {
    var ou = ((window.AUTH || {}).oauthUrl || '').replace(/\/$/, '');
    if (!ou) return;
    var hits = $('#page-hits'); if (!hits) return;            // 글 상세에만 존재
    var vkey = 'hg-viewed:' + location.pathname;
    var firstView = !localStorage.getItem(vkey);
    if (firstView) { try { localStorage.setItem(vkey, '1'); } catch (e) {} }
    fetch(ou + '/views?path=' + encodeURIComponent(location.pathname) + (firstView ? '&inc=1' : ''))
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.count != null) { hits.textContent = j.count; var w = $('.stat-views'); if (w) w.hidden = false; } })
      .catch(function () {});
  }
  /* 총 방문(고유 방문자): 브라우저당 사이트 첫 방문에만 +1(쓰기), 그 외엔 읽기만. 사이드바에 표시. */
  function countVisitors() {
    var ou = ((window.AUTH || {}).oauthUrl || '').replace(/\/$/, '');
    var sh = $('#site-hits'); if (!ou || !sh) return;
    var firstEver = !localStorage.getItem('hg-visited');
    if (firstEver) { try { localStorage.setItem('hg-visited', '1'); } catch (e) {} }
    fetch(ou + '/views?path=__visitors__' + (firstEver ? '&inc=1' : ''))
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.count != null) sh.textContent = fmtNum(j.count); })
      .catch(function () {});
  }

  /* ---------- boot ---------- */
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function () {
    renderSidebar();
    renderAuthBtn();
    bindSidebar();
    bindGlobal();
    bindSearch();
    if ($('#view-home')) { routeHome(); bindHome(); }
    markActiveNav();
    initPost();
    countViews();
    countVisitors();
  });
})();
