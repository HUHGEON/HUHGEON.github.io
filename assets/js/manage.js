/* ============================================================
   Category + Tag management (owner). Drives sidebar, filters,
   editor category select. Persists to localStorage.
   ============================================================ */
(function () {
  'use strict';
  var KEY = 'hg-taxonomy-v2';

  function uid() { return 'x' + Math.random().toString(36).slice(2, 9); }

  var DEFAULT = {
    categories: [
      { id: uid(), name: 'Category A', count: 2, children: [{ id: uid(), name: 'Subcategory a', count: 2 }] },
      { id: uid(), name: 'Category B', count: 3, children: [{ id: uid(), name: 'Subcategory b', count: 2 }, { id: uid(), name: 'Subcategory c', count: 1 }] },
      { id: uid(), name: 'Blog', count: 1, children: [{ id: uid(), name: '일상', count: 1 }] }
    ],
    tags: ['개발', 'book', '일상', 'romance']
  };

  var model;
  // 실제 블로그 데이터(window.CAT_NODES / window.POSTS)로부터 카테고리·태그 시드
  function realCategories() {
    var nodes = window.CAT_NODES || [], posts = window.POSTS || [];
    var order = [], map = {};
    nodes.forEach(function (n) {
      if (!map[n.cat]) { map[n.cat] = { id: uid(), name: n.cat, count: 0, children: [] }; order.push(n.cat); }
      if (n.sub && !map[n.cat].children.some(function (c) { return c.name === n.sub; })) {
        map[n.cat].children.push({ id: uid(), name: n.sub, count: 0 });
      }
    });
    posts.forEach(function (p) {
      if (!map[p.cat]) { map[p.cat] = { id: uid(), name: p.cat, count: 0, children: [] }; order.push(p.cat); }
      if (p.sub && !map[p.cat].children.some(function (c) { return c.name === p.sub; })) {
        map[p.cat].children.push({ id: uid(), name: p.sub, count: 0 });
      }
    });
    order.forEach(function (cn) {
      var c = map[cn];
      c.count = posts.filter(function (p) { return p.cat === cn; }).length;
      c.children.forEach(function (ch) { ch.count = posts.filter(function (p) { return p.cat === cn && p.sub === ch.name; }).length; });
    });
    return order.map(function (cn) { return map[cn]; });
  }
  function realTags() {
    var posts = window.POSTS || [], m = {}, ord = [];
    posts.forEach(function (p) { (p.tags || []).forEach(function (t) { if (!(t in m)) { m[t] = 0; ord.push(t); } m[t]++; }); });
    return ord;
  }
  function load() {
    if ((window.CAT_NODES && window.CAT_NODES.length) || (window.POSTS && window.POSTS.length)) {
      return { categories: realCategories(), tags: realTags() };
    }
    try { var s = JSON.parse(localStorage.getItem(KEY)); if (s && s.categories && s.tags) return s; } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULT));
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(model)); } catch (e) {} }

  /* ---------- GitHub 으로 실제 카테고리 폴더(index.md) 생성 ---------- */
  function pushCategoryFolder(cat, sub) {
    var toast = window.__toast || function (m) { console.log(m); };
    if (!window.__ghPutFile || !window.__ghToken || !window.__ghToken()) {
      toast('로컬에만 추가됐어요 — 실제 반영하려면 에디터에서 “GitHub 연결” 후 다시 추가하세요');
      return;
    }
    var conf = window.__ghConf();
    var path = '_pages/' + cat + (sub ? '/' + sub : '') + '/index.md';
    toast('GitHub에 카테고리 생성 중…');
    window.__ghPutFile(conf, window.__ghToken(), path, '---\n---\n', 'add category: ' + (sub || cat))
      .then(function () { toast('✅ ' + path + ' 생성 — 곧 사이트에 반영됩니다'); })
      .catch(function (e) { toast('생성 실패: ' + e.message); });
  }

  var ICON = {
    folder: '<svg viewBox="0 0 24 24"><path d="M3 7l2-2h5l2 2h7a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V7z"></path></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"></path></svg>',
    chev: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"></path></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"></path></svg>'
  };
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  ready(function () {
    var $ = function (s) { return document.querySelector(s); };
    model = load();

    var navCats = $('#nav-cats'), navTags = $('#nav-tags'),
        mgTree = $('#mg-tree'), mgTags = $('#mg-tags'),
        edCat = $('#ed-cat'), homeFilters = document.querySelector('#view-home .filters');

    /* ---------- renderers ---------- */
    function renderSidebar() {
      if (!navCats) return;
      // preserve which categories are expanded across re-renders
      var openIds = {};
      navCats.querySelectorAll('.nav-cat.open').forEach(function (n) { openIds[n.getAttribute('data-cid')] = 1; });
      navCats.innerHTML = model.categories.map(function (c) {
        var kids = (c.children || []);
        var hasKids = kids.length > 0;
        var row = '<div class="nav-item cat-row" data-go="home" data-cat="' + esc(c.name) + '">' +
          '<span class="ico">' + ICON.folder + '</span>' +
          '<span class="nav-name">' + esc(c.name) + '</span>' +
          (hasKids ? '<button class="nav-exp" aria-label="펼치기">' + ICON.chev + '</button>' : '') +
          '<span class="badge">' + (c.count != null ? c.count : kids.length) + '</span></div>';
        var subs = hasKids ? '<div class="nav-children">' + kids.map(function (ch, i) {
          return '<div class="nav-item sub' + (i === kids.length - 1 ? ' last' : '') + '" data-go="home" data-cat="' + esc(c.name) + '" data-sub="' + esc(ch.name) + '">' +
            esc(ch.name) + '<span class="badge">' + (ch.count != null ? ch.count : 0) + '</span></div>';
        }).join('') + '</div>' : '';
        return '<div class="nav-cat' + (openIds[c.id] ? ' open' : '') + '" data-cid="' + c.id + '">' + row + subs + '</div>';
      }).join('');
    }
    function renderNavTags() {
      if (!navTags) return;
      navTags.innerHTML = model.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('');
    }
    function renderFilters() {
      if (!homeFilters) return;
      var active = homeFilters.querySelector('.chip.on');
      var cur = active ? active.textContent : 'all';
      homeFilters.innerHTML = '<button class="chip' + (cur === 'all' ? ' on' : '') + '">all</button>' +
        model.tags.map(function (t) { return '<button class="chip' + (cur === t ? ' on' : '') + '">' + esc(t) + '</button>'; }).join('');
    }
    function renderEditorSelect() {
      if (!edCat) return;
      var prev = edCat.value;
      var opts = [];
      model.categories.forEach(function (c) {
        if (c.children && c.children.length) {
          c.children.forEach(function (ch) { opts.push(c.name + ' · ' + ch.name); });
        } else { opts.push(c.name); }
      });
      edCat.innerHTML = opts.map(function (o) { return '<option' + (o === prev ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('');
      if (opts.indexOf(prev) === -1 && opts.length) edCat.value = opts[0];
      edCat.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function renderTree() {
      if (!mgTree) return;
      mgTree.innerHTML = model.categories.map(function (c) {
        var row = '<div class="tax-row" data-cat="' + c.id + '">' +
          '<span class="tax-ico">' + ICON.folder + '</span>' +
          '<input class="tax-name" data-cat="' + c.id + '" value="' + esc(c.name) + '">' +
          '<button class="tax-btn add" data-addsub="' + c.id + '" title="하위 추가">' + ICON.plus + '</button>' +
          '<button class="tax-btn del" data-delcat="' + c.id + '" title="삭제">' + ICON.x + '</button>' +
          '</div>';
        var subs = (c.children || []).map(function (ch) {
          return '<div class="tax-row child" data-child="' + ch.id + '">' +
            '<input class="tax-name" data-cat="' + c.id + '" data-child="' + ch.id + '" value="' + esc(ch.name) + '">' +
            '<button class="tax-btn del" data-delchild="' + ch.id + '" data-pcat="' + c.id + '" title="삭제">' + ICON.x + '</button>' +
            '</div>';
        }).join('');
        return row + subs;
      }).join('');
    }
    function renderMgTags() {
      if (!mgTags) return;
      mgTags.innerHTML = model.tags.map(function (t) {
        return '<span class="mg-tag" draggable="true" data-tag="' + esc(t) + '">' +
          '<span class="grip">⠿</span>' + esc(t) +
          '<button class="x" data-deltag="' + esc(t) + '" title="삭제">' + ICON.x + '</button></span>';
      }).join('');
    }

    function renderConsumers() { renderSidebar(); renderNavTags(); renderFilters(); renderEditorSelect(); }
    function renderAll() { renderConsumers(); renderTree(); renderMgTags(); save(); }

    /* ---------- tree interactions ---------- */
    function findCat(id) { return model.categories.filter(function (c) { return c.id === id; })[0]; }

    if (mgTree) {
      mgTree.addEventListener('input', function (e) {
        var inp = e.target.closest('.tax-name'); if (!inp) return;
        var cat = findCat(inp.getAttribute('data-cat')); if (!cat) return;
        var childId = inp.getAttribute('data-child');
        if (childId) {
          var ch = (cat.children || []).filter(function (x) { return x.id === childId; })[0];
          if (ch) ch.name = inp.value;
        } else { cat.name = inp.value; }
        renderConsumers(); save();   // don't rebuild tree (keep focus)
      });
      mgTree.addEventListener('click', function (e) {
        var addsub = e.target.closest('[data-addsub]');
        if (addsub) {
          var c = findCat(addsub.getAttribute('data-addsub'));
          if (c) {
            var sname = (prompt('“' + c.name + '” 에 추가할 세부 카테고리 이름') || '').trim();
            if (!sname) return;
            c.children = c.children || [];
            if (c.children.some(function (x) { return x.name === sname; })) { alert('이미 있는 세부 카테고리예요'); return; }
            c.children.push({ id: uid(), name: sname, count: 0 });
            renderAll();
            pushCategoryFolder(c.name, sname);
          }
          return;
        }
        var delcat = e.target.closest('[data-delcat]');
        if (delcat) {
          var id = delcat.getAttribute('data-delcat');
          model.categories = model.categories.filter(function (x) { return x.id !== id; });
          renderAll(); return;
        }
        var delchild = e.target.closest('[data-delchild]');
        if (delchild) {
          var pc = findCat(delchild.getAttribute('data-pcat'));
          var cid = delchild.getAttribute('data-delchild');
          if (pc) pc.children = (pc.children || []).filter(function (x) { return x.id !== cid; });
          renderAll(); return;
        }
      });
    }
    function focusLast(catId) {
      var rows = mgTree.querySelectorAll('.tax-row.child input.tax-name[data-cat="' + catId + '"]');
      var last = rows[rows.length - 1];
      if (last) { last.focus(); last.select(); }
    }

    var addCatBtn = $('#mg-add-cat');
    if (addCatBtn) addCatBtn.addEventListener('click', function () {
      var name = (prompt('새 카테고리 이름을 입력하세요') || '').trim();
      if (!name) return;
      if (model.categories.some(function (c) { return c.name === name; })) { alert('이미 있는 카테고리예요'); return; }
      model.categories.push({ id: uid(), name: name, count: 0, children: [] });
      renderAll();
      pushCategoryFolder(name, null);
    });

    /* ---------- tag interactions ---------- */
    var tagForm = $('#mg-tagform'), tagInput = $('#mg-taginput');
    if (tagForm) tagForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = (tagInput.value || '').trim().replace(/^#/, '');
      if (v && model.tags.indexOf(v) === -1) { model.tags.push(v); renderNavTags(); renderFilters(); renderMgTags(); save(); }
      tagInput.value = '';
    });
    if (mgTags) {
      mgTags.addEventListener('click', function (e) {
        var x = e.target.closest('[data-deltag]'); if (!x) return;
        var t = x.getAttribute('data-deltag');
        model.tags = model.tags.filter(function (g) { return g !== t; });
        renderNavTags(); renderFilters(); renderMgTags(); save();
      });
      // drag reorder
      var dragTag = null;
      mgTags.addEventListener('dragstart', function (e) {
        var el = e.target.closest('.mg-tag'); if (!el) return;
        dragTag = el.getAttribute('data-tag'); el.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      mgTags.addEventListener('dragend', function () {
        dragTag = null;
        mgTags.querySelectorAll('.mg-tag').forEach(function (n) { n.classList.remove('dragging', 'drop-target'); });
      });
      mgTags.addEventListener('dragover', function (e) {
        e.preventDefault();
        var over = e.target.closest('.mg-tag');
        mgTags.querySelectorAll('.mg-tag').forEach(function (n) { n.classList.remove('drop-target'); });
        if (over && over.getAttribute('data-tag') !== dragTag) over.classList.add('drop-target');
      });
      mgTags.addEventListener('drop', function (e) {
        e.preventDefault();
        var over = e.target.closest('.mg-tag'); if (!over || dragTag == null) return;
        var target = over.getAttribute('data-tag');
        var from = model.tags.indexOf(dragTag), to = model.tags.indexOf(target);
        if (from === -1 || to === -1 || from === to) return;
        model.tags.splice(from, 1);
        model.tags.splice(to, 0, dragTag);
        renderNavTags(); renderFilters(); renderMgTags(); save();
      });
    }

    /* ---------- filter chips (delegated; survives re-render) ---------- */
    if (homeFilters) homeFilters.addEventListener('click', function (e) {
      var chip = e.target.closest('.chip'); if (!chip) return;
      homeFilters.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('on'); });
      chip.classList.add('on');
    });

    /* ---------- sidebar navigation: expand + filter ---------- */
    if (navCats) navCats.addEventListener('click', function (e) {
      var sub = e.target.closest('.nav-item.sub');
      if (sub) { if (window.__filter) window.__filter(sub.getAttribute('data-cat'), sub.getAttribute('data-sub')); return; }
      var catRow = e.target.closest('.cat-row');
      if (catRow) {
        var wrap = catRow.closest('.nav-cat');
        if (wrap) wrap.classList.toggle('open');
        if (window.__filter) window.__filter(catRow.getAttribute('data-cat'), null);
      }
    });
    var navAll = document.getElementById('nav-all');
    if (navAll) navAll.addEventListener('click', function () { if (window.__filter) window.__filter(null); });

    /* ---------- initial paint ---------- */
    renderAll();
  });
})();
