(function () {
  'use strict';
  var C = window.ResourceCore;
  var kind = document.body.getAttribute('data-catalog');
  var isGroup = kind === 'groups';
  var doc = window.__HUB_RESOURCES__;
  var state = { q: '', category: '', org: '', college: '', sort: 'date' };
  var $ = function (id) { return document.getElementById(id); };
  var collegeFilter = $('collegeFilter'); // 仅政策页有学院筛选
  var items = doc && Array.isArray(doc[kind]) ? doc[kind] : null;
  var categories = isGroup ? ['QQ群', 'QQ频道'] : ['竞赛认定', '创新学分', '推免', '奖学金', '评优'];
  var feedbackTimer;

  function syncUrl() {
    try {
      var q = new URLSearchParams();
      ['q', 'category', 'org', 'college'].forEach(function (key) { if (state[key]) q.set(key, state[key]); });
      if (state.sort !== 'date') q.set('sort', state.sort);
      history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q.toString() : ''));
    } catch (e) { /* Direct file previews do not always allow replaceState. */ }
  }
  function policy(item) {
    return '<article class="policy-row"><div><span class="resource-label">' + C.esc(item.category) + '</span>' +
      '<h3>' + C.external(item.url, item.title) + '</h3>' +
      '<p class="resource-description">适用范围：' + C.esc(item.scope) + '</p>' +
      '<div class="resource-meta"><span>' + C.esc(item.org) + '</span><time datetime="' + C.esc(item.date) + '">发布于 ' + C.esc(item.date) + '</time>' +
      (item.code ? '<span>' + C.esc(item.code) + '</span>' : '') + '</div>' +
      '<p class="resource-description">' + C.esc(item.note) + '</p></div><div class="policy-actions">' + C.external(item.url, '查看官网原文', 'resource-btn') + '</div></article>';
  }
  function group(item) {
    return '<article class="group-card"><div class="resource-meta"><span class="resource-label">' + C.esc(item.category) + '</span><span>' + C.esc(item.season) + ' · 官网公布</span></div>' +
      '<h3>' + C.esc(item.title) + '</h3><div class="resource-meta"><span>' + C.esc(item.org) + '</span></div>' +
      '<p class="resource-description">' + C.esc(item.scope) + '<br>' + C.esc(item.note) + '</p>' +
      (item.category === 'QQ群' ? '<div class="group-number"><div><small>QQ群号</small><strong>' + C.esc(item.number) + '</strong></div><button type="button" class="resource-btn primary" data-copy="' + C.esc(item.id) + '" aria-label="复制' + C.esc(item.title) + '群号">复制群号</button></div>' : '<div class="group-number">' + C.external(item.url, '打开 QQ 频道', 'resource-btn primary') + '</div>') +
      '<div class="group-source">' + C.external(item.sourceUrl, '查看通知来源') + '<span>来源发布 ' + C.esc(item.date) + '</span></div></article>';
  }
  function render() {
    var result = C.filter(items, state);
    if ($('sortSummary')) $('sortSummary').textContent = state.sort === 'name' ? '按文件名称排序' : '按官网页面发布日期排序';
    // chips 计数：学院/单位/搜索筛选后按当前子集重算（仅政策页有学院维度；QQ 群页维持全量计数）
    var subset = items;
    if (collegeFilter) subset = items.filter(function (item) {
      return (!state.org || item.org === state.org) &&
        (!state.college || item.college === state.college) && C.matches(item, state.q);
    });
    $('categoryChips').innerHTML = [''].concat(categories).map(function (category) {
      var count = subset.filter(function (item) { return !category || item.category === category; }).length;
      return '<button type="button" data-category="' + C.esc(category) + '" aria-pressed="' + (state.category === category) + '">' + (category || '全部') + '<small>' + count + '</small></button>';
    }).join('');
    $('resultCount').textContent = '找到 ' + result.length + (isGroup ? ' 个群与频道' : ' 份文件');
    $('catalogList').hidden = result.length === 0;
    $('catalogList').innerHTML = result.map(isGroup ? group : policy).join('');
    $('emptyState').hidden = result.length !== 0;
    $('emptyTitle').textContent = state.category === 'QQ频道' && !items.some(function (i) { return i.category === 'QQ频道'; }) ? '频道资料正在补充' : '没有找到匹配的内容';
    $('emptyText').textContent = state.category === 'QQ频道' ? '目前尚未收录有可靠来源的 QQ 频道链接，可以先查看已收录的通知群。' : '试试减少筛选条件，或换一个关键词。';
    syncUrl();
  }
  function reset() {
    state = { q: '', category: '', org: '', college: '', sort: 'date' };
    $('searchInput').value = ''; $('orgFilter').value = ''; $('sortFilter').value = 'date';
    if (collegeFilter) collegeFilter.value = '';
    $('manualCopy').hidden = true;
    render();
  }
  function feedback(message) {
    clearTimeout(feedbackTimer);
    $('feedback').textContent = message; $('feedback').hidden = false;
    feedbackTimer = setTimeout(function () { $('feedback').hidden = true; }, 3500);
  }
  function fallbackCopy(number) {
    var input = $('copyValue');
    $('manualCopy').hidden = false; input.value = number; input.focus(); input.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { /* Manual selection stays available. */ }
    if (ok) $('manualCopy').hidden = true;
    return ok;
  }
  function copy(item, button) {
    var previousFocus = document.activeElement;
    var promise = navigator.clipboard && window.isSecureContext ? navigator.clipboard.writeText(item.number) : Promise.reject(new Error('Clipboard unavailable'));
    promise.catch(function () { if (!fallbackCopy(item.number)) throw new Error('请选中下方群号手动复制。'); }).then(function () {
      $('manualCopy').hidden = true; button.textContent = '已复制'; feedback('群号 ' + item.number + ' 已复制');
      if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
      setTimeout(function () { if (document.contains(button)) button.textContent = '复制群号'; }, 2200);
    }).catch(function () { feedback('自动复制未成功，请使用已选中的群号。'); });
  }
  if (!C || !items) {
    $('emptyState').hidden = false; $('emptyTitle').textContent = '资料暂时无法读取';
    $('emptyText').textContent = '请刷新页面重试。若仍无法读取，请联系维护者检查资源文件。';
    $('resourceControls').hidden = true; $('emptyReset').hidden = true;
    $('resultCount').textContent = '加载失败';
    return;
  }
  var orgs = Array.from(new Set(items.map(function (i) { return i.org; }))).sort(function (a, b) { return a.localeCompare(b, 'zh-CN'); });
  $('orgFilter').innerHTML = '<option value="">全部单位</option>' + orgs.map(function (o) { return '<option value="' + C.esc(o) + '">' + C.esc(o) + '</option>'; }).join('');
  // 学院筛选（仅政策页）：全部学院 / 全校通用 / 各学院（按数据出现顺序），option 带条数
  if (collegeFilter) {
    var collegeOrder = [];
    items.forEach(function (i) { if (collegeOrder.indexOf(i.college) < 0) collegeOrder.push(i.college); });
    var countBy = function (value) { return items.filter(function (i) { return i.college === value; }).length; };
    var options = [{ value: '', label: '全部学院', count: items.length },
      { value: '全校通用', label: '全校通用', count: countBy('全校通用') }];
    collegeOrder.filter(function (c) { return c !== '全校通用'; }).forEach(function (c) {
      options.push({ value: c, label: c, count: countBy(c) });
    });
    collegeFilter.innerHTML = options.map(function (o) {
      return '<option value="' + C.esc(o.value) + '">' + C.esc(o.label) + '（' + o.count + '）</option>';
    }).join('');
  }
  var params = new URLSearchParams(location.search);
  state.q = params.get('q') || '';
  if (categories.indexOf(params.get('category')) >= 0) state.category = params.get('category');
  if (orgs.indexOf(params.get('org')) >= 0) state.org = params.get('org');
  if (collegeFilter && items.some(function (i) { return i.college === params.get('college'); })) state.college = params.get('college');
  if (params.get('sort') === 'name') state.sort = 'name';
  $('searchInput').value = state.q; $('orgFilter').value = state.org; $('sortFilter').value = state.sort;
  if (collegeFilter) collegeFilter.value = state.college;
  $('checkedDate').textContent = '来源核对 ' + doc.checkedAt;
  $('searchInput').addEventListener('input', function () { state.q = this.value; render(); });
  $('orgFilter').addEventListener('change', function () { state.org = this.value; render(); });
  if (collegeFilter) collegeFilter.addEventListener('change', function () { state.college = this.value; render(); });
  $('sortFilter').addEventListener('change', function () { state.sort = this.value; render(); });
  $('categoryChips').addEventListener('click', function (e) {
    var button = e.target.closest('button[data-category]');
    if (button) { state.category = button.getAttribute('data-category'); render();
      Array.from($('categoryChips').querySelectorAll('button')).filter(function (b) { return b.getAttribute('data-category') === state.category; })[0].focus(); }
  });
  $('resetFilters').addEventListener('click', reset); $('emptyReset').addEventListener('click', reset);
  $('catalogList').addEventListener('click', function (e) {
    var button = e.target.closest('button[data-copy]');
    if (!button) return;
    var item = items.filter(function (i) { return i.id === button.getAttribute('data-copy'); })[0];
    if (item && /^\d{5,12}$/.test(item.number)) copy(item, button);
  });
  render();
})();
