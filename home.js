/* Formal homepage: preserves the approved demo interactions and notice snapshot. */
(function () {
  'use strict';
  var core = window.ResourceCore;
  var esc = core.esc;
  var comps = Array.isArray(window.__COMPETITIONS__) ? window.__COMPETITIONS__ : [];
  var eventData = window.__EVENTS__;
  var events = Array.isArray(eventData) ? eventData : (eventData && Array.isArray(eventData.events) ? eventData.events : []);
  var resources = window.__HUB_RESOURCES__ || {};
  var policies = Array.isArray(resources.policies) ? resources.policies : [];
  var groups = Array.isArray(resources.groups) ? resources.groups : [];
  var notices = window.__DEMO_NOTICES__ || {items: []};
  var arrow = '<svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg>';
  var externalIcon = '<svg class="icon" aria-hidden="true"><use href="#i-external"/></svg>';
  var external = ' target="_blank" rel="noopener noreferrer"';
  var byId = function (id) { return document.getElementById(id); };
  var count = function (n) { return Number(n).toLocaleString('zh-CN'); };
  var empty = function (text) { return '<p class="empty-state">' + esc(text) + '</p>'; };
  var stats = [
    ['赛事', window.__COMPETITIONS__ ? comps.length : null],
    ['时间记录', eventData ? events.length : null],
    ['政策文件', resources.policies ? policies.length : null],
    ['通知群', resources.groups ? groups.filter(function (g) { return g.category === 'QQ群'; }).length : null]
  ];
  byId('collection-stats').innerHTML = stats.map(function (item) {
    return '<div><dt>' + item[0] + '</dt><dd>' + (item[1] === null ? '—' : count(item[1])) + '</dd></div>';
  }).join('');

  byId('notice-list').innerHTML = notices.items.length ? notices.items.map(function (n) {
    var url = core.safeUrl(n.url);
    if (!url) return '';
    return '<a class="notice-row" href="' + esc(url) + '"' + external + '><time class="notice-date" datetime="' + esc(n.date) + '" aria-label="发布于' + esc(n.date) + '"><strong>' + esc(n.date.slice(8)) + '</strong><span>' + esc(n.date.slice(0,7).replace('-','.')) + '</span></time><div class="notice-copy"><h3>' + esc(n.title) + '</h3><p><span>' + esc(n.tag) + '</span>查看学校原文 ' + externalIcon + '</p></div></a>';
  }).join('') : empty('通知暂未载入，可通过栏目右侧入口访问学院官网。');
  if (notices.checkedAt) byId('notice-source').textContent = '整理于 ' + notices.checkedAt + ' · 后续变更与参赛要求请查看原文。';

  var policyIds = ['competition-2025', 'credits-2025', 'scholarship-2024', 'honors-2024'];
  var featuredPolicies = policyIds.map(function (id) { return policies.find(function (p) { return p.id === id; }); }).filter(Boolean);
  byId('policy-list').innerHTML = featuredPolicies.length ? featuredPolicies.map(function (p) {
    var url = core.safeUrl(p.url);
    if (!url) return '';
    return '<a class="policy-item" href="' + esc(url) + '"' + external + '><h3>' + esc(p.title) + '</h3><div class="policy-meta"><span>' + esc(p.category) + '</span><time datetime="' + esc(p.date) + '">' + esc(p.date) + '</time></div><p>' + esc(p.org) + ' · 查看原文 ' + externalIcon + '</p></a>';
  }).join('') : empty('政策暂未载入，请进入官网政策页查阅。');

  // Match the history page's date semantics: count by actual start date, never the edition label.
  var thisYear = new Date().getFullYear();
  var yearCounts = {};
  events.forEach(function (e) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(e.start || ''));
    if (!match) return;
    var year = +match[1], month = +match[2], day = +match[3];
    var date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || year >= thisYear) return;
    yearCounts[year] = (yearCounts[year] || 0) + 1;
  });
  var years = Object.keys(yearCounts).map(Number).sort(function (a,b) { return b-a; }).slice(0,4);
  byId('year-list').innerHTML = years.length ? years.map(function (year) {
    return '<a class="year-link" href="./history/index.html?year=' + year + '"><strong>' + year + '</strong><span>' + count(yearCounts[year]) + ' 条时间记录</span>' + arrow + '</a>';
  }).join('') + '<p class="year-note">按记录起始年份归档 · 包含待核实记录</p>' : empty('暂无可展示的往年记录。');

  var featuredGroups = groups.filter(function (g) { return g.category === 'QQ群'; }).slice(0,3);
  byId('group-list').innerHTML = featuredGroups.length ? featuredGroups.map(function (g) {
    var url = core.safeUrl(g.sourceUrl);
    return '<article class="group-item"><h3><a href="./qq/index.html?q=' + encodeURIComponent(g.number) + '">' + esc(g.title) + '</a></h3><p>' + esc(g.org) + ' · ' + esc(g.season) + '</p><div class="group-bottom"><button class="copy-group" type="button" data-number="' + esc(g.number) + '" aria-label="复制' + esc(g.title) + '群号' + esc(g.number) + '"><span>' + esc(g.number) + '</span><svg class="icon" aria-hidden="true"><use href="#i-copy"/></svg></button>' + (url ? '<a class="group-source" href="' + esc(url) + '"' + external + '>通知来源 ' + externalIcon + '</a>' : '<span>暂无来源</span>') + '</div></article>';
  }).join('') : empty('通知群暂未载入，请进入QQ群与频道页查阅。');

  var slides = [
    {image:'hero-333.jpg',alt:'夕阳下的武汉科技大学校园湖景与教学楼',title:['在武科大，','发现你的下一种可能。'],description:'查竞赛、找政策、看历年，让每一次出发更有方向。',label:'查看竞赛日历',href:'./calendar/index.html',caption:'校园风光 · 湖畔向晚',position:'59% center'},
    {image:'hero-111.jpg',alt:'武汉科技大学湖畔的图书馆与蓝天',title:['从一个想法，','走向更大的赛场。'],description:'浏览已收录赛事，找到适合自己的方向与官方报名入口。',label:'浏览赛事总览',href:'./competitions/index.html',caption:'校园风光 · 湖光书影',position:'50% center'},
    {image:'hero-123.jpg',alt:'武汉科技大学创新创业学院大楼入口',title:['让每一份努力，','都有清晰的指引。'],description:'竞赛认定、创新学分、奖学金与推免细则，从学校原文查起。',label:'查阅官网政策',href:'./policy/index.html',caption:'创新创业学院 · 创新从这里出发',position:'70% center'}
  ];
  var slideButtons = document.querySelectorAll('[data-slide]');
  var currentSlide = 0;
  var rotationTimer;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var rotationPaused = reducedMotion.matches;
  var rotationToggle = byId('rotation-toggle');
  var heroImage = byId('hero-image');

  // 轮播图：每张图先独立解码，解码完成后才动 <img> 的 src，避免切换瞬间的空窗/闪白。
  // 每张都用自己的探测对象（含第 1 张）：若第 1 张直接复用 hero <img> 本身，
  // applySlide 里就成了同一对象自比较，切走后永远回不到第 1 张。
  // 探测对象与 hero <img> 同 URL，浏览器按同一份缓存取图，不产生额外请求。
  var slideElements = Object.create(null);
  var slideDecoded = Object.create(null);
  var swapToken = 0;

  function slideImageUrl(index) { return './assets/' + slides[index].image; }

  function slideElement(index) {
    if (slideElements[index]) return slideElements[index];
    var image = new Image();
    image.decoding = 'async';
    image.src = slideImageUrl(index);
    slideElements[index] = image;
    slideDecoded[index] = image.decode ? image.decode().catch(function () {}) : Promise.resolve();
    return image;
  }

  // 第 1 张的探测对象立刻建好：它与 hero <img> 同 URL，请求合并成一次，
  // 同时让这张图始终有存活引用，切走再切回时直接命中缓存、不重新下载。
  slideElement(0);

  function preloadSlides() {
    slides.forEach(function (slide, index) { slideElement(index); });
  }

  function schedulePreload() {
    if (window.requestIdleCallback) window.requestIdleCallback(preloadSlides, { timeout: 1500 });
    else window.setTimeout(preloadSlides, 200);
  }
  if (document.readyState === 'complete') schedulePreload();
  else window.addEventListener('load', schedulePreload, { once: true });

  function applySlide(index, image) {
    currentSlide = index;
    var slide = slides[index];
    if (heroImage.src !== image.src) heroImage.src = image.src;
    heroImage.alt = slide.alt;
    heroImage.style.objectPosition = slide.position;
    byId('hero-title').innerHTML = slide.title.map(esc).join('<br>');
    byId('hero-description').textContent = slide.description;
    byId('hero-link').href = slide.href;
    byId('hero-link').innerHTML = esc(slide.label) + ' ' + arrow;
    byId('photo-caption').textContent = slide.caption;
    slideButtons.forEach(function (button) { button.setAttribute('aria-pressed', String(Number(button.dataset.slide) === index)); });
  }

  function showSlide(index) {
    var token = ++swapToken;
    var image = slideElement(index);
    var ready = slideDecoded[index] || Promise.resolve();
    // 解码完成（或失败）前保持当前画面；失败时直接切换兜底，任何情况下都不留空白帧。
    return ready.then(function () {
      if (token !== swapToken) return;
      applySlide(index, image);
    });
  }

  function restartRotation() {
    window.clearInterval(rotationTimer);
    if (!rotationPaused && !document.hidden) {
      rotationTimer = window.setInterval(function () { showSlide((currentSlide + 1) % slides.length); }, 5000);
    }
    rotationToggle.setAttribute('aria-label', rotationPaused ? '播放自动轮播' : '暂停自动轮播');
    rotationToggle.title = rotationPaused ? '播放自动轮播' : '暂停自动轮播';
    rotationToggle.innerHTML = '<svg class="icon" aria-hidden="true">' + (rotationPaused ? '<path d="m8 5 11 7-11 7Z"/>' : '<path d="M8 5v14M16 5v14"/>') + '</svg>';
    byId('hero-copy').setAttribute('aria-live', rotationPaused ? 'polite' : 'off');
  }

  slideButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      showSlide(Number(button.dataset.slide));
      restartRotation();
    });
  });
  rotationToggle.addEventListener('click', function () {
    rotationPaused = !rotationPaused;
    restartRotation();
  });
  document.addEventListener('visibilitychange', restartRotation);
  reducedMotion.addEventListener('change', function (event) {
    rotationPaused = event.matches;
    restartRotation();
  });
  restartRotation();

  var toastTimer;
  function toast(message) {
    window.clearTimeout(toastTimer);
    byId('copy-status').textContent = message;
    byId('copy-status').hidden = false;
    toastTimer = window.setTimeout(function () { byId('copy-status').hidden = true; }, 4500);
  }
  byId('group-list').addEventListener('click', async function (event) {
    var button = event.target.closest('[data-number]');
    if (!button) return;
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(button.dataset.number);
      toast('群号 ' + button.dataset.number + ' 已复制');
    } catch (error) {
      var article = button.closest('article');
      var fallback = article.querySelector('.copy-fallback');
      if (!fallback) {
        fallback = document.createElement('label');
        fallback.className = 'copy-fallback';
        fallback.textContent = '自动复制未成功，请长按或按 Ctrl+C 复制：';
        var input = document.createElement('input');
        input.readOnly = true;
        input.value = button.dataset.number;
        input.setAttribute('aria-label', '手动复制群号');
        fallback.appendChild(input);
        article.appendChild(fallback);
      }
      fallback.querySelector('input').focus();
      fallback.querySelector('input').select();
      toast('请手动复制已选中的群号');
    }
  });

  var searchIndex = comps.map(function (c) {
    return {kind:'赛事',title:c.name,detail:c.org,fields:[c.name,c.org,c.cat,c.audience,c.no].join(' '),href:'./calendar/index.html?no=' + encodeURIComponent(c.no)};
  }).concat(policies.map(function (p) {
    return {kind:'政策',title:p.title,detail:p.org + ' · ' + p.category,fields:[p.title,p.org,p.category,p.scope,p.code].join(' '),href:'./policy/index.html?q=' + encodeURIComponent(p.title)};
  }), groups.map(function (g) {
    return {kind:'群号',title:g.title,detail:g.org + ' · ' + g.season,fields:[g.title,g.org,g.number,g.season].join(' '),href:'./qq/index.html?q=' + encodeURIComponent(g.number || g.title)};
  }));
  function search() {
    var query = byId('search-input').value.trim();
    if (!query) { closeSearch(false); byId('search-input').focus(); return; }
    var terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    var results = searchIndex.filter(function (item) {
      var text = item.fields.toLocaleLowerCase();
      return terms.every(function (term) { return text.indexOf(term) >= 0; });
    });
    byId('search-panel').hidden = false;
    byId('search-summary').textContent = '“' + query + '” · 找到 ' + results.length + ' 项' + (results.length > 12 ? '，显示前 12 项，请补充关键词缩小范围' : '');
    byId('search-results').innerHTML = results.length ? results.slice(0,12).map(function (item) {
      return '<a class="search-result" href="' + esc(item.href) + '"><span>' + item.kind + '</span><div><strong>' + esc(item.title) + '</strong><small>' + esc(item.detail) + '</small></div></a>';
    }).join('') : empty(searchIndex.length ? '没有找到相关资源。试试赛事简称、学院名称、“创新学分”或群号。' : '资源数据暂未载入，请通过主导航进入对应页面。');
  }
  function closeSearch(restoreFocus) {
    byId('search-panel').hidden = true;
    if (restoreFocus) byId('search-input').focus();
  }
  byId('site-search').addEventListener('submit', function (event) { event.preventDefault(); search(); });
  byId('search-input').addEventListener('input', function () {
    if (!byId('search-input').value.trim()) closeSearch(false);
    else if (!byId('search-panel').hidden) search();
  });
  byId('close-search').addEventListener('click', function () { closeSearch(true); });
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && !byId('search-panel').hidden) closeSearch(true); });
})();
