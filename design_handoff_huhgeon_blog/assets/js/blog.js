/* ============================================================
   HUHGEON's Blog — app logic (vanilla, no deps)
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Accent palette (also used by Tweaks) ---------- */
  var ACCENTS = {
    blue:     { a: '#7aa2c9', a2: '#9bbbde', deep: '#5b82a8' },
    sage:     { a: '#88a880', a2: '#a6c29e', deep: '#688a60' },
    clay:     { a: '#c08a6e', a2: '#d6a78d', deep: '#9c6b50' },
    lavender: { a: '#9b8bc4', a2: '#b6a8d8', deep: '#7a6aa6' },
    slate:    { a: '#8a93a3', a2: '#a6aeba', deep: '#6b7484' }
  };
  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function applyAccent(hex) {
    var set = null;
    for (var k in ACCENTS) { if (ACCENTS[k].a.toLowerCase() === hex.toLowerCase()) { set = ACCENTS[k]; break; } }
    var rgb = hexToRgb(hex);
    var soft = 'rgba(' + rgb.join(',') + ',.14)';
    var line = 'rgba(' + rgb.join(',') + ',.30)';
    var glow = 'radial-gradient(58% 70% at 50% -4%, rgba(' + rgb.join(',') + ',.12), transparent 68%)';
    var r = document.documentElement.style;
    r.setProperty('--accent', hex);
    r.setProperty('--accent-2', set ? set.a2 : hex);
    r.setProperty('--accent-deep', set ? set.deep : hex);
    r.setProperty('--accent-soft', soft);
    r.setProperty('--accent-line', line);
    r.setProperty('--glow', glow);
  }
  window.__applyAccent = applyAccent;

  /* ---------- Theme ---------- */
  var TKEY = 'hg-theme';
  function applyTheme(t) { document.body.classList.toggle('light', t === 'light'); }
  applyTheme(localStorage.getItem(TKEY) || 'dark');
  var validAccents = Object.keys(ACCENTS).map(function (k) { return ACCENTS[k].a; });
  var savedAccent = localStorage.getItem('hg-accent');
  if (savedAccent && validAccents.indexOf(savedAccent.toLowerCase()) === -1) savedAccent = null;
  if (savedAccent) applyAccent(savedAccent);

  /* ---------- Owner mode (write button visible to owner only) ---------- */
  function setOwner(on) {
    if (on) localStorage.setItem('hg-owner', '1'); else localStorage.removeItem('hg-owner');
    document.body.classList.toggle('owner', !!on);
  }
  window.__setOwner = setOwner;
  (function initOwner() {
    var h = (location.hash || '').toLowerCase();
    if (h === '#owner') localStorage.setItem('hg-owner', '1');
    if (h === '#guest' || h === '#logout') localStorage.removeItem('hg-owner');
    // Prototype default: owner ON unless explicitly switched to guest.
    if (localStorage.getItem('hg-owner') === null) localStorage.setItem('hg-owner', '1');
    document.body.classList.toggle('owner', localStorage.getItem('hg-owner') === '1');
  })();

  /* ---------- Palette preset (?pal=b) ---------- */
  (function initPal() {
    var m = (location.search || '').match(/[?&]pal=([a-z]+)/i);
    if (m && m[1].toLowerCase() === 'b') document.body.classList.add('pal-b');
  })();

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var $ = function (s, r) { return (r || document).querySelector(s); };
    var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

    /* theme toggle */
    var themeBtn = $('#theme');
    if (themeBtn) themeBtn.addEventListener('click', function () {
      var now = document.body.classList.contains('light') ? 'dark' : 'light';
      localStorage.setItem(TKEY, now); applyTheme(now);
      if (window.__syncTheme) window.__syncTheme(now);
    });

    /* ---------- View switching ---------- */
    var crumb = $('#crumb');
    function setCrumb(html) { if (crumb) crumb.innerHTML = html; }
    function show(view, opts) {
      $$('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-' + view); });
      document.body.classList.toggle('editing', view === 'editor');
      if (view === 'home') setCrumb('<span>Blog</span><span class="sep">/</span><span class="cur">전체 글</span>');
      else if (view === 'post') setCrumb('<span>Category B</span><span class="sep">/</span><span class="cur">Online Library</span>');
      else if (view === 'manage') setCrumb('<span>Admin</span><span class="sep">/</span><span class="cur">카테고리 · 태그 관리</span>');
      if (view !== 'editor') window.scrollTo(0, 0);
      if (opts && opts.focus) { var ti = $('#ed-title'); if (ti) ti.focus(); }
    }
    window.__show = show;

    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-act]')) return;
      var op = e.target.closest('[data-open]'); if (op) { if (op.getAttribute('data-open') === 'post') populatePost(op); show(op.getAttribute('data-open')); maybeCloseDrawer(); }
      var go = e.target.closest('[data-go]');
      if (go) {
        show(go.getAttribute('data-go'));
        $$('.nav-item').forEach(function (n) { n.classList.remove('active'); });
        if (go.classList.contains('nav-item')) go.classList.add('active');
        maybeCloseDrawer();
      }
    });

    /* ---------- Owner post actions (edit / delete) ---------- */
    var PENCIL = '<svg viewBox="0 0 512 512"><path d="M362.7 19.3L314.3 67.7 444.3 197.7l48.4-48.4c25-25 25-65.5 0-90.5L453.3 19.3c-25-25-65.5-25-90.5 0zm-71 71L58.6 323.5c-10.4 10.4-18 23.3-22.2 37.4L1 481.2C-1.5 489.7 .8 498.8 7 505s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L421.7 220.3 291.7 90.3z"/></svg>';
    var TRASH = '<svg viewBox="0 0 448 512"><path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"/></svg>';
    function decorateRows() {
      $$('#view-home .row').forEach(function (r) {
        var body = r.querySelector('.row-body');
        var cat = body && body.querySelector('.row-cat');
        var tags = body && body.querySelector('.row-meta .tags');
        if (cat && tags && !cat.parentNode.classList.contains('row-top')) {
          var wrap = document.createElement('div'); wrap.className = 'row-top';
          cat.parentNode.insertBefore(wrap, cat);
          wrap.appendChild(cat); wrap.appendChild(tags);
        }
        if (!r.querySelector('.row-actions')) {
          var a = document.createElement('div'); a.className = 'row-actions';
          a.innerHTML = '<button class="row-act edit" data-act="edit" title="수정">' + PENCIL + '</button>' +
                        '<button class="row-act del" data-act="del" title="삭제">' + TRASH + '</button>';
          r.appendChild(a);
        }
      });
    }
    window.__decorateRows = decorateRows;
    decorateRows();
    var toastEl = $('#toast'), toastMsg = $('#toast-msg'), toastTimer;
    function showToast(msg) {
      if (!toastEl) return;
      if (toastMsg) toastMsg.textContent = msg;
      toastEl.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
    }
    document.addEventListener('click', function (e) {
      var actEl = e.target.closest('[data-act]'); if (!actEl) return;
      e.preventDefault(); e.stopPropagation();
      var act = actEl.getAttribute('data-act');
      if (act === 'edit') { show('editor'); }
      else if (act === 'del') {
        var row = actEl.closest('.row');
        if (row) {
          row.style.transition = 'opacity .2s, transform .2s'; row.style.opacity = '0'; row.style.transform = 'translateX(-8px)';
          setTimeout(function () { row.remove(); }, 200); showToast('글이 삭제되었습니다');
        } else { show('home'); showToast('글이 삭제되었습니다'); }
      }
    });

    /* ---------- Category filter ---------- */
    function filterPosts(cat, sub) {
      show('home');
      var hero = $('#view-home .hero'), filters = $('#view-home .filters'),
          sec = $('#view-home .sec-head'), homeHead = $('#view-home .home-head'),
          catHeader = $('#cat-header'), rows = $$('#view-home .row'), na = $('#nav-recent'),
          rowsC = $('#view-home .rows');
      if (rowsC) rowsC.style.display = '';
      if (allView) allView.style.display = 'none';
      if (!cat) {
        [hero, filters, sec, homeHead].forEach(function (el) { if (el) el.style.display = ''; });
        if (catHeader) { catHeader.hidden = true; catHeader.innerHTML = ''; }
        rows.forEach(function (r) { r.style.display = ''; });
        $$('.nav-item').forEach(function (n) { n.classList.remove('active'); });
        if (na) na.classList.add('active');
        setCrumb('<span>Blog</span><span class="sep">/</span><span class="cur">전체 글</span>');
        window.scrollTo(0, 0);
        return;
      }
      [hero, filters, sec, homeHead].forEach(function (el) { if (el) el.style.display = 'none'; });
      var label = sub || cat, n = 0;
      rows.forEach(function (r) {
        var ok = r.getAttribute('data-cat') === cat && (!sub || r.getAttribute('data-sub') === sub);
        r.style.display = ok ? '' : 'none'; if (ok) n++;
      });
      if (catHeader) {
        catHeader.hidden = false;
        catHeader.innerHTML =
          '<button class="cat-back" data-all="1">← 전체 글</button>' +
          '<div class="cat-h-cmd"><b>$</b> ls ~/' + cat.replace(/\s+/g, '-') + (sub ? '/' + sub.replace(/\s+/g, '-') : '') + '</div>' +
          '<h1>' + label + '</h1><p class="sub">' + n + '개의 글</p>' +
          (n === 0 ? '<div class="cat-empty">아직 이 카테고리에 글이 없어요 — 새 글 쓰기로 첫 글을 남겨보세요.</div>' : '');
      }
      setCrumb('<span>' + cat + '</span><span class="sep">/</span><span class="cur">' + (sub || '전체') + '</span>');
      window.scrollTo(0, 0);
    }
    window.__filter = filterPosts;
    document.addEventListener('click', function (e) { var a = e.target.closest('[data-all]'); if (a) { e.preventDefault(); filterPosts(null); } });

    /* ---------- Full post list (모두 보기, offset pagination) + 북마크 ---------- */
    var TH = 'assets/img/thumbnail/';
    var ALL_POSTS = [
      { title: '블로그를 시작합니다', cat: 'Blog', sub: '일상', tags: ['일상','시작'], date: '2026.06.08', read: '3분', excerpt: 'GitHub Pages와 Jekyll로 첫 블로그를 열었습니다. 앞으로 개발하면서 배운 것과 공부 정리를 남깁니다.', thumb: TH+'nightgardenflower.jpg', bookmark: true },
      { title: 'My personal Online Library', cat: 'Category B', sub: 'Subcategory b', tags: ['book','education'], date: '2023.12.03', read: '5분', excerpt: '읽은 책을 한 곳에 모아두는 개인 라이브러리를 만들었습니다. 기록의 힘을 믿으며.', thumb: TH+'bricks.webp', bookmark: true },
      { title: 'Classic Literature #1: Romeo and Juliet', cat: 'Category B', sub: 'Subcategory b', tags: ['book','romance'], date: '2023.12.04', read: '6분', excerpt: '셰익스피어 비극의 정수. star-crossed lovers라 불리는 두 주인공과 가문의 반목에 대한 짧은 기록.', thumb: TH+'sample.png' },
      { title: 'Git 브랜치 전략 정리', cat: 'Category A', sub: 'Subcategory a', tags: ['개발','git'], date: '2024.01.10', read: '7분', excerpt: 'git-flow, trunk-based 등 팀에서 써본 브랜치 전략들의 장단점을 비교 정리했습니다.', thumb: 'assets/img/example.jpg' },
      { title: '클린 코드 다시 읽기', cat: 'Category B', sub: 'Subcategory b', tags: ['book','개발'], date: '2024.03.15', read: '8분', excerpt: '몇 년 만에 다시 읽으니 보이는 것들. 의미 있는 이름과 작은 함수에 대한 메모.', thumb: TH+'book.jpg', bookmark: true },
      { title: '코드 리뷰를 잘 받는 법', cat: 'Category A', sub: 'Subcategory a', tags: ['개발'], date: '2024.02.02', read: '4분', excerpt: 'PR을 작게 쪼개고, 맥락을 먼저 적어두면 리뷰가 훨씬 빨라집니다.', empty: true },
      { title: 'Docker로 개발환경 통일하기', cat: 'Category B', sub: 'Subcategory c', tags: ['개발','docker'], date: '2024.05.20', read: '9분', excerpt: '"제 컴퓨터에선 되는데요"를 없애기 위한 Dockerfile/compose 설정 기록.', empty: true },
      { title: '주간 회고를 시작했습니다', cat: 'Blog', sub: '일상', tags: ['일상','회고'], date: '2024.04.01', read: '3분', excerpt: '매주 금요일 30분, 한 주를 돌아보는 루틴을 만들었습니다.', thumb: TH+'nightgardenflower.jpg' },
      { title: '사이드 프로젝트 배포기', cat: 'Category B', sub: 'Subcategory c', tags: ['개발'], date: '2024.06.11', read: '6분', excerpt: '작은 토이 프로젝트를 실제로 배포하며 만난 문제들과 해결 과정.', thumb: 'assets/img/example.jpg' },
      { title: '셰익스피어 비극 정주행', cat: 'Category B', sub: 'Subcategory b', tags: ['book','romance'], date: '2024.07.07', read: '5분', excerpt: '햄릿, 맥베스, 리어왕까지 — 비극 4대 작품을 읽고 남긴 짧은 감상.', thumb: TH+'sample.png' },
      { title: 'Example Post: thumbnail 사용법', cat: 'Category A', sub: 'Subcategory a', tags: ['guide'], date: '2023.12.02', read: '2분', excerpt: 'front matter의 thumbnail 속성에 이미지 경로를 채우면 글 헤더에 대표 이미지가 표시됩니다.', empty: true },
      { title: 'Example Post: no thumbnail image', cat: 'Category A', sub: 'Subcategory a', tags: ['guide'], date: '2023.12.01', read: '2분', excerpt: '대표 이미지가 없을 때의 레이아웃. 썸네일이 없으면 헤더가 자동으로 컴팩트하게 줄어듭니다.', empty: true }
    ];
    function rowMarkup(p, idx) {
      var thumb = p.empty
        ? '<div class="row-thumb empty"></div>'
        : '<div class="row-thumb" style="background-image:url(\'' + p.thumb + '\')"></div>';
      var pad = (idx < 10 ? '0' : '') + idx;
      return '<article class="row" data-open="post" data-cat="' + p.cat + '" data-sub="' + p.sub +
        '" data-title="' + p.title.replace(/"/g, '&quot;') + '" data-tags="' + p.tags.join(',') + '">' +
        '<div class="row-idx">' + pad + '</div><div class="row-body">' +
        '<div class="row-cat">' + p.cat + ' · ' + p.sub + '</div><h4>' + p.title + '</h4><p>' + p.excerpt + '</p>' +
        '<div class="row-meta"><span>' + p.date + '</span><span class="dotsep">·</span><span>' + p.read + '</span>' +
        '<span class="tags">' + p.tags.map(function (t) { return '<span class="tag">' + t + '</span>'; }).join('') + '</span></div></div>' +
        thumb + '</article>';
    }
    var allView = null, PER = 6;
    function ensureAllView() {
      var content = $('#view-home .content'); if (!content) return null;
      if (!allView) { allView = document.createElement('section'); allView.className = 'all-view'; allView.id = 'all-view'; content.appendChild(allView); }
      ['.home-head', '.hero', '.filters', '.sec-head', '.rows'].forEach(function (s) { var el = $('#view-home ' + s); if (el) el.style.display = 'none'; });
      var ch = $('#cat-header'); if (ch) { ch.hidden = true; ch.innerHTML = ''; }
      allView.style.display = '';
      return allView;
    }
    function showAll(page) {
      if (!ensureAllView()) return;
      var pages = Math.ceil(ALL_POSTS.length / PER);
      page = Math.max(1, Math.min(page || 1, pages));
      var start = (page - 1) * PER, slice = ALL_POSTS.slice(start, start + PER);
      var pager = '';
      for (var i = 1; i <= pages; i++) pager += '<button class="pg-num' + (i === page ? ' on' : '') + '" data-pg="' + i + '">' + i + '</button>';
      allView.innerHTML =
        '<div class="all-head"><button class="cat-back" data-all="1">← 최근 글</button>' +
        '<div class="cat-h-cmd"><b>$</b> ls -la ~/posts <span style="color:var(--faint)">| wc -l → ' + ALL_POSTS.length + '</span></div>' +
        '<h1>전체 글</h1><p class="sub">총 ' + ALL_POSTS.length + '개 · ' + page + ' / ' + pages + ' 페이지</p></div>' +
        '<div class="rows all-rows">' + slice.map(function (p, k) { return rowMarkup(p, start + k + 1); }).join('') + '</div>' +
        '<div class="pagination">' +
        '<button class="pg-arrow" data-pg="' + (page - 1) + '"' + (page === 1 ? ' disabled' : '') + '>← 이전</button>' + pager +
        '<button class="pg-arrow" data-pg="' + (page + 1) + '"' + (page === pages ? ' disabled' : '') + '>다음 →</button></div>';
      decorateRows(); window.scrollTo(0, 0);
      $$('.nav-item').forEach(function (n) { n.classList.remove('active'); });
      var nap = $('#nav-all-posts'); if (nap) nap.classList.add('active');
      setCrumb('<span>Blog</span><span class="sep">/</span><span class="cur">전체 글 (' + ALL_POSTS.length + ')</span>');
    }
    function showBookmarks() { /* removed */ }
    var seeAll = $('#see-all'); if (seeAll) seeAll.addEventListener('click', function (e) { e.preventDefault(); showAll(1); });
    var navAllPosts = $('#nav-all-posts'); if (navAllPosts) navAllPosts.addEventListener('click', function () { showAll(1); });
    document.addEventListener('click', function (e) { var pg = e.target.closest('.pagination [data-pg]'); if (pg && !pg.disabled) showAll(+pg.getAttribute('data-pg')); });

    /* ---------- Search (inline dropdown in topbar) ---------- */
    var sInput = $('#tb-search-input'), sResults = $('#tb-search-results');
    function renderSearch(q) {
      if (!sResults) return;
      q = (q || '').trim().toLowerCase();
      var listed = q ? ALL_POSTS.filter(function (p) {
        return (p.title + ' ' + p.tags.join(' ') + ' ' + p.cat + ' ' + p.sub + ' ' + (p.excerpt || '')).toLowerCase().indexOf(q) > -1;
      }) : ALL_POSTS;
      if (!listed.length) { sResults.innerHTML = '<div class="search-empty">검색 결과가 없어요</div>'; return; }
      sResults.innerHTML = listed.slice(0, 8).map(function (p) {
        return '<div class="search-item" data-open="post" data-cat="' + p.cat + '" data-sub="' + p.sub +
          '" data-title="' + p.title.replace(/"/g, '&quot;') + '" data-tags="' + p.tags.join(',') + '">' +
          '<div class="si-main"><div class="si-cat">' + p.cat + ' · ' + p.sub + '</div><div class="si-title">' + p.title + '</div></div>' +
          '<div class="si-tags">' + p.tags.map(function (t) { return '<span class="tag">' + t + '</span>'; }).join('') + '</div></div>';
      }).join('');
    }
    function openResults() { if (sResults) { renderSearch(sInput.value); sResults.hidden = false; } }
    function closeResults() { if (sResults) sResults.hidden = true; }
    if (sInput) {
      sInput.addEventListener('input', openResults);
      sInput.addEventListener('focus', openResults);
    }
    if (sResults) sResults.addEventListener('click', function (e) { if (e.target.closest('[data-open]')) { closeResults(); if (sInput) { sInput.blur(); sInput.value = ''; } } });
    document.addEventListener('click', function (e) { if (!e.target.closest('.tb-search-wrap')) closeResults(); });
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); if (sInput) { sInput.focus(); openResults(); } }
      else if (e.key === 'Escape') { closeResults(); if (sInput) sInput.blur(); }
    });

    /* ---------- Post navigation: open with the clicked post's data ---------- */
    function populatePost(el) {
      var title = el.getAttribute('data-title'), cat = el.getAttribute('data-cat'), sub = el.getAttribute('data-sub');
      var tags = (el.getAttribute('data-tags') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      var h1 = $('#view-post .post-hero h1'); if (h1 && title) h1.textContent = title;
      var catEl = $('#view-post .post-hero .cat');
      if (catEl && cat) {
        var svg = catEl.querySelector('svg'); catEl.textContent = '';
        if (svg) catEl.appendChild(svg);
        catEl.appendChild(document.createTextNode(' ' + cat + (sub ? ' · ' + sub : '')));
      }
      var tagBox = $('#view-post .post-tags');
      if (tagBox && tags.length) tagBox.innerHTML = tags.map(function (t) { return '<span class="tag">' + t + '</span>'; }).join('');
      // cover image = the clicked post's thumbnail (empty -> hidden)
      var ct = el.querySelector('.row-thumb') || el.querySelector('.bg') || el.querySelector('.thumb');
      var coverEl = $('#view-post .cover');
      if (coverEl) {
        if (ct && !ct.classList.contains('empty') && ct.style.backgroundImage && ct.style.backgroundImage !== 'none') {
          coverEl.style.display = ''; coverEl.style.backgroundImage = ct.style.backgroundImage;
        } else { coverEl.style.display = 'none'; }
      }
      var leadEl = $('#view-post .post-hero .lead'); if (leadEl) leadEl.style.display = '';
      // category-based related posts
      var relGrid = $('#view-post .rel-grid');
      if (relGrid) {
        var all = [];
        $$('#view-home .row, #view-home .hero').forEach(function (p) {
          var t = p.querySelector('.row-thumb') || p.querySelector('.bg');
          all.push({
            title: p.getAttribute('data-title'), cat: p.getAttribute('data-cat'),
            sub: p.getAttribute('data-sub') || '', tags: p.getAttribute('data-tags') || '',
            empty: !!p.querySelector('.row-thumb.empty'), thumb: t ? t.style.backgroundImage : ''
          });
        });
        var rel = all.filter(function (p) { return p.cat === cat && p.title !== title; });
        all.forEach(function (p) { if (rel.length < 2 && p.title !== title && rel.indexOf(p) === -1) rel.push(p); });
        rel = rel.slice(0, 2);
        relGrid.innerHTML = rel.map(function (p) {
          var th = (p.empty || !p.thumb || p.thumb === 'none')
            ? '<div class="thumb empty"></div>'
            : '<div class="thumb" style="background-image:' + p.thumb + '"></div>';
          return '<article class="card" data-open="post" data-cat="' + p.cat + '" data-sub="' + p.sub +
            '" data-title="' + (p.title || '').replace(/"/g, '&quot;') + '" data-tags="' + p.tags + '">' + th +
            '<div class="body"><div class="cat">' + p.cat + (p.sub ? ' · ' + p.sub : '') + '</div><h4>' + (p.title || '') + '</h4></div></article>';
        }).join('');
      }
    }

    /* ---------- Like + comments ---------- */
    (function engageInit() {
      function esc2(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
      var likeBtn = $('#like-btn');
      if (likeBtn) {
        var likeCount = $('#like-count'), LKEY = 'hg-like', base = 28;
        var paint = function () {
          var on = localStorage.getItem(LKEY) === '1';
          likeBtn.classList.toggle('on', on);
          likeBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
          var v = base + (on ? 1 : 0);
          if (likeCount) likeCount.textContent = v;
          var bl = $('#byline-likes'); if (bl) bl.textContent = v;
        };
        likeBtn.addEventListener('click', function () {
          localStorage.setItem(LKEY, localStorage.getItem(LKEY) === '1' ? '0' : '1'); paint();
        });
        paint();
      }
      var list = $('#comment-list'), input = $('#comment-input'), submit = $('#comment-submit');
      if (list) {
        var CKEY = 'hg-comments-v2';
        var SEED = [
          { n: 'jisoo', t: '기록하는 습관 정말 공감돼요. 저도 분기 회고 시작해봐야겠어요!', ago: '2일 전', replies: [{ n: 'huhgeon', t: '감사합니다! 회고 템플릿도 곧 공유할게요 :)', ago: '1일 전' }] },
          { n: 'devkim', t: 'git log 비유 좋네요 ㅎㅎ 잘 읽었습니다.', ago: '5일 전', replies: [] }
        ];
        var comments;
        try { comments = JSON.parse(localStorage.getItem(CKEY)); } catch (e) {}
        if (!Array.isArray(comments)) comments = JSON.parse(JSON.stringify(SEED));
        var saveC = function () { localStorage.setItem(CKEY, JSON.stringify(comments)); };
        var total = function () { return comments.reduce(function (s, c) { return s + 1 + ((c.replies || []).length); }, 0); };
        var counts = function () { var c = total(); ['#comment-count', '#comment-count2', '#byline-comments'].forEach(function (s) { var el = $(s); if (el) el.textContent = c; }); };
        var ava = function (n) { return n ? esc2(n[0].toUpperCase()) : '?'; };
        var avatarImg = function (n) {
          if (n === 'you') return 'assets/img/me.jpg';
          return 'https://api.dicebear.com/7.x/identicon/svg?seed=' + encodeURIComponent(n || 'anon') + '&backgroundColor=ffffff';
        };
        var replyHTML = function (rp, i, ri) {
          return '<li class="comment reply"><img class="c-avatar" src="' + avatarImg(rp.n) + '" alt=""><div class="c-body">' +
            '<div class="c-meta"><span class="c-name">' + esc2(rp.n) + '</span><span class="c-time">' + esc2(rp.ago || '방금') + '</span>' +
            '<button class="c-del" data-rdel="' + i + '.' + ri + '">삭제</button></div>' +
            '<div class="c-text">' + esc2(rp.t) + '</div></div></li>';
        };
        var render = function () {
          list.innerHTML = comments.map(function (c, i) {
            var reps = (c.replies || []).map(function (rp, ri) { return replyHTML(rp, i, ri); }).join('');
            return '<li class="comment"><img class="c-avatar" src="' + avatarImg(c.n) + '" alt=""><div class="c-body">' +
              '<div class="c-meta"><span class="c-name">' + esc2(c.n) + '</span><span class="c-time">' + esc2(c.ago || '방금') + '</span>' +
              '<button class="c-del" data-cdel="' + i + '">삭제</button></div>' +
              '<div class="c-text">' + esc2(c.t) + '</div>' +
              '<div class="c-actions"><button class="c-reply" data-reply="' + i + '">답글</button></div>' +
              (reps ? '<ul class="reply-list">' + reps + '</ul>' : '') +
              '<div class="reply-form" data-rf="' + i + '" hidden><textarea placeholder="답글을 입력하세요"></textarea><button class="btn-primary reply-submit" data-rsub="' + i + '">등록</button></div>' +
              '</div></li>';
          }).join('');
          counts();
        };
        if (submit) submit.addEventListener('click', function () {
          var v = (input.value || '').trim(); if (!v) return;
          comments.unshift({ n: 'you', t: v, ago: '방금', replies: [] }); saveC(); render(); input.value = '';
        });
        list.addEventListener('click', function (e) {
          var rep = e.target.closest('[data-reply]');
          if (rep) {
            var rf = list.querySelector('.reply-form[data-rf="' + rep.getAttribute('data-reply') + '"]');
            if (rf) { rf.hidden = !rf.hidden; if (!rf.hidden) { var ta0 = rf.querySelector('textarea'); if (ta0) ta0.focus(); } }
            return;
          }
          var rsub = e.target.closest('[data-rsub]');
          if (rsub) {
            var ri0 = +rsub.getAttribute('data-rsub');
            var ta = rsub.parentNode.querySelector('textarea');
            var rv = (ta.value || '').trim(); if (!rv) return;
            comments[ri0].replies = comments[ri0].replies || [];
            comments[ri0].replies.push({ n: 'you', t: rv, ago: '방금' });
            saveC(); render(); return;
          }
          var cdel = e.target.closest('[data-cdel]');
          if (cdel) { comments.splice(+cdel.getAttribute('data-cdel'), 1); saveC(); render(); return; }
          var rdel = e.target.closest('[data-rdel]');
          if (rdel) {
            var parts = rdel.getAttribute('data-rdel').split('.'), ci = +parts[0], rii = +parts[1];
            if (comments[ci] && comments[ci].replies) { comments[ci].replies.splice(rii, 1); saveC(); render(); }
            return;
          }
        });
        render();
      }
    })();

    /* ---------- Mobile drawer ---------- */
    var sb = $('#sidebar'), scrim = $('#scrim');
    function closeDrawer() { if (sb) sb.classList.remove('open'); if (scrim) scrim.classList.remove('show'); }
    function maybeCloseDrawer() { if (window.innerWidth <= 940) closeDrawer(); }
    var hamb = $('#hamb');
    if (hamb) hamb.addEventListener('click', function () { sb.classList.add('open'); scrim.classList.add('show'); });
    if (scrim) scrim.addEventListener('click', closeDrawer);

    /* ---------- Filters (visual) ---------- */
    $$('.filters .chip').forEach(function (c) {
      c.addEventListener('click', function () {
        var group = c.parentNode;
        $$('.chip', group).forEach(function (x) { x.classList.remove('on'); });
        c.classList.add('on');
      });
    });

    /* ---------- Copy buttons ---------- */
    document.addEventListener('click', function (e) {
      var cp = e.target.closest('.copy'); if (!cp) return;
      var pre = cp.closest('.codeblock').querySelector('pre');
      if (pre && navigator.clipboard) navigator.clipboard.writeText(pre.innerText);
      var t = cp.querySelector('.cl'); if (t) { var o = t.textContent; t.textContent = 'Copied'; setTimeout(function () { t.textContent = o; }, 1200); }
    });

    /* ---------- TOC scrollspy ---------- */
    var tocLinks = $$('#view-post .toc a');
    var secs = tocLinks.map(function (a) { return document.querySelector(a.getAttribute('href')); });
    window.addEventListener('scroll', function () {
      if (!$('#view-post').classList.contains('active')) return;
      var y = window.scrollY + 130, idx = 0;
      secs.forEach(function (s, i) { if (s && s.offsetTop <= y) idx = i; });
      tocLinks.forEach(function (a, i) { a.classList.toggle('active', i === idx); });
    }, { passive: true });

    /* ====================================================== */
    /*  Markdown parser                                       */
    /* ====================================================== */
    function esc(s) {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function inline(s) {
      // images first, then links
      s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function (_, alt, src) {
        return '<img src="' + src.trim() + '" alt="' + alt + '">';
      });
      s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, txt, href) {
        return '<a href="' + href.trim() + '" target="_blank" rel="noopener">' + txt + '</a>';
      });
      s = s.replace(/`([^`]+)`/g, function (_, c) { return '<code>' + c + '</code>'; });
      s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
      return s;
    }
    function highlightCode(code, lang) {
      var h = esc(code);
      // comments (# or //)
      h = h.replace(/(^|\n)(\s*(?:#|\/\/)[^\n]*)/g, function (_, br, c) { return br + '<span class="tok-com">' + c + '</span>'; });
      // strings
      h = h.replace(/(&quot;[^&]*?&quot;|'[^']*?')/g, '<span class="tok-str">$1</span>');
      // yaml-ish keys
      if (lang === 'yaml' || lang === 'yml' || lang === '') {
        h = h.replace(/(^|\n)(\s*[\w-]+)(:)/g, '$1<span class="tok-key">$2</span>$3');
      }
      // keywords
      h = h.replace(/\b(const|let|var|function|return|if|else|for|while|import|from|export|class|true|false|null|def|new)\b/g,
        '<span class="tok-key">$1</span>');
      // numbers
      h = h.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-num">$1</span>');
      return h;
    }
    function md(src) {
      src = src.replace(/\r\n/g, '\n');
      var out = [], lines = src.split('\n'), i = 0;
      function flushPara(buf) { if (buf.length) { out.push('<p>' + inline(buf.join(' ')) + '</p>'); buf.length = 0; } }
      var para = [];
      while (i < lines.length) {
        var ln = lines[i];
        // fenced code
        var fence = ln.match(/^```\s*(\w*)/);
        if (fence) {
          flushPara(para);
          var lang = fence[1] || '', body = [];
          i++;
          while (i < lines.length && !/^```/.test(lines[i])) { body.push(lines[i]); i++; }
          i++; // skip closing fence
          out.push(
            '<div class="codeblock"><div class="cb-head">' +
            '<span class="d" style="background:#cf8a93"></span><span class="d" style="background:#c2a06a"></span><span class="d" style="background:#86ad8e"></span>' +
            '<span class="lang">' + (lang || 'code') + '</span>' +
            '<button class="copy"><svg viewBox="0 0 384 512"><path d="M192 0c-41.8 0-77.4 26.7-90.5 64H64C28.7 64 0 92.7 0 128V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V128c0-35.3-28.7-64-64-64H282.5C269.4 26.7 233.8 0 192 0zm0 64a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"/></svg><span class="cl">Copy</span></button>' +
            '</div><pre>' + highlightCode(body.join('\n'), lang) + '</pre></div>'
          );
          continue;
        }
        // heading
        var hd = ln.match(/^(#{1,3})\s+(.*)$/);
        if (hd) {
          flushPara(para);
          var lvl = hd[1].length;
          if (lvl === 2) out.push('<h2><span class="hash">##</span>' + inline(hd[2]) + '</h2>');
          else if (lvl === 3) out.push('<h3>' + inline(hd[2]) + '</h3>');
          else out.push('<h2>' + inline(hd[2]) + '</h2>');
          i++; continue;
        }
        // hr
        if (/^(---|\*\*\*|___)\s*$/.test(ln)) { flushPara(para); out.push('<hr>'); i++; continue; }
        // blockquote
        if (/^>\s?/.test(ln)) {
          flushPara(para); var q = [];
          while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, '')); i++; }
          out.push('<blockquote><p>' + inline(q.join(' ')) + '</p></blockquote>');
          continue;
        }
        // unordered list
        if (/^\s*[-*]\s+/.test(ln)) {
          flushPara(para); var items = [];
          while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push('<li>' + inline(lines[i].replace(/^\s*[-*]\s+/, '')) + '</li>'); i++; }
          out.push('<ul>' + items.join('') + '</ul>');
          continue;
        }
        // ordered list
        if (/^\s*\d+\.\s+/.test(ln)) {
          flushPara(para); var oitems = [];
          while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { oitems.push('<li>' + inline(lines[i].replace(/^\s*\d+\.\s+/, '')) + '</li>'); i++; }
          out.push('<ol>' + oitems.join('') + '</ol>');
          continue;
        }
        // blank line
        if (/^\s*$/.test(ln)) { flushPara(para); i++; continue; }
        // paragraph line
        para.push(ln); i++;
      }
      flushPara(para);
      return out.join('\n');
    }

    /* ====================================================== */
    /*  Editor                                                */
    /* ====================================================== */
    var area = $('#ed-area');
    if (area) {
      var prev = $('#ed-prose');
      var tEl = $('#ed-title'), cEl = $('#ed-cat'), gEl = $('#ed-tags');
      var pvTitle = $('#pv-title'), pvCat = $('#pv-cat'), pvTags = $('#pv-tags'), pvDate = $('#pv-date');

      function render() {
        prev.innerHTML = md(area.value);
        var title = (tEl.value || '').trim();
        pvTitle.textContent = title || '제목 없음';
        pvCat.textContent = cEl.value || 'Uncategorized';
        var tags = (gEl.value || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        pvTags.innerHTML = tags.map(function (t) { return '<span class="tag">' + t + '</span>'; }).join('');
        // live filename
        var fn = $('#ed-file');
        if (fn) {
          var slug = title.toLowerCase().replace(/[^\w가-힣\s-]/g, '').replace(/\s+/g, '-').slice(0, 28) || 'untitled';
          fn.textContent = '2026-06-08-' + slug + '.md';
        }
      }
      [area, tEl, cEl, gEl].forEach(function (el) { if (el) el.addEventListener('input', render); });

      // toolbar insert
      function wrap(before, after, placeholder) {
        var s = area.selectionStart, e = area.selectionEnd;
        var sel = area.value.slice(s, e) || placeholder || '';
        area.value = area.value.slice(0, s) + before + sel + after + area.value.slice(e);
        area.focus();
        area.selectionStart = s + before.length;
        area.selectionEnd = s + before.length + sel.length;
        render();
      }
      function linePrefix(prefix) {
        var s = area.selectionStart;
        var lineStart = area.value.lastIndexOf('\n', s - 1) + 1;
        area.value = area.value.slice(0, lineStart) + prefix + area.value.slice(lineStart);
        area.focus(); area.selectionStart = area.selectionEnd = s + prefix.length;
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
          else if (act === 'codeblock') wrap('\n```js\n', '\n```\n', 'console.log("hi")');
          else if (act === 'quote') linePrefix('> ');
          else if (act === 'list') linePrefix('- ');
          else if (act === 'link') wrap('[', '](https://)', '링크');
          else if (act === 'image') wrap('![', '](https://)', 'alt');
        });
      });

      // tab inserts spaces
      area.addEventListener('keydown', function (e) {
        if (e.key === 'Tab') {
          e.preventDefault();
          var s = area.selectionStart;
          area.value = area.value.slice(0, s) + '  ' + area.value.slice(area.selectionEnd);
          area.selectionStart = area.selectionEnd = s + 2;
        }
      });

      // image drag & drop / paste -> insert into markdown (live)
      function insertAtCursor(text) {
        var s = area.selectionStart, e = area.selectionEnd;
        area.value = area.value.slice(0, s) + text + area.value.slice(e);
        area.selectionStart = area.selectionEnd = s + text.length;
        area.focus(); render();
      }
      function handleImageFiles(files) {
        Array.prototype.forEach.call(files, function (f) {
          if (!f || f.type.indexOf('image/') !== 0) return;
          var reader = new FileReader();
          reader.onload = function (ev) {
            var name = (f.name || 'image').replace(/\.[^.]+$/, '');
            insertAtCursor('\n![' + name + '](' + ev.target.result + ')\n');
          };
          reader.readAsDataURL(f);
        });
      }
      area.addEventListener('dragover', function (e) { e.preventDefault(); area.classList.add('drag'); });
      area.addEventListener('dragleave', function () { area.classList.remove('drag'); });
      area.addEventListener('drop', function (e) {
        e.preventDefault(); area.classList.remove('drag');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) handleImageFiles(e.dataTransfer.files);
      });
      area.addEventListener('paste', function (e) {
        var items = e.clipboardData && e.clipboardData.items; if (!items) return;
        for (var i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image/') === 0) { var f = items[i].getAsFile(); if (f) { e.preventDefault(); handleImageFiles([f]); } }
        }
      });

      // mobile tabs
      $$('.ed-tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
          $$('.ed-tab').forEach(function (x) { x.classList.remove('on'); });
          tab.classList.add('on');
          var which = tab.getAttribute('data-tab');
          $('.ed-pane.write').classList.toggle('shown', which === 'write');
          $('.ed-pane.preview').classList.toggle('shown', which === 'preview');
        });
      });

      // publish toast
      var pub = $('#ed-publish');
      if (pub) pub.addEventListener('click', function () {
        var title = (tEl.value || '').trim() || '제목 없음';
        var catVal = cEl.value || '';
        var tags = (gEl.value || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        var h1 = document.querySelector('#view-post .post-hero h1'); if (h1) h1.textContent = title;
        var catEl = document.querySelector('#view-post .post-hero .cat');
        if (catEl) { var svg = catEl.querySelector('svg'); catEl.textContent = ''; if (svg) catEl.appendChild(svg); catEl.appendChild(document.createTextNode(' ' + catVal)); }
        var lead = document.querySelector('#view-post .post-hero .lead'); if (lead) lead.style.display = 'none';
        var when = document.querySelector('#view-post .post-byline .when'); if (when) when.textContent = '2026.06.08 · 방금';
        var tagBox = document.querySelector('#view-post .post-tags'); if (tagBox) tagBox.innerHTML = tags.map(function (t) { return '<span class="tag">' + t + '</span>'; }).join('');
        var prose = document.querySelector('#view-post .prose'); if (prose) prose.innerHTML = md(area.value);
        var pcover = document.querySelector('#view-post .cover');
        var firstImg = prose ? prose.querySelector('img') : null;
        if (pcover) { if (firstImg) { pcover.style.display = ''; pcover.style.backgroundImage = 'url("' + firstImg.src + '")'; } else { pcover.style.display = 'none'; } }
        if (window.__show) window.__show('post');
        showToast('발행되었습니다 — 글 페이지로 이동했어요');
      });

      render();
    }
  });
})();
