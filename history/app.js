(function () {
  'use strict';
  var HD = window.HubData, C = window.ResourceCore;
  var $ = function (id) { return document.getElementById(id); };
  var currentYear = new Date().getFullYear(), pageSize = 40;
  var events = [], comps = [], years = [], defaultYear = '', types = [];
  var state = { view: 'year', year: '', no: '', q: '', type: '', hide: false, page: 1 };

  function yearLabel(year) {
    return year + (Number(year) > currentYear ? ' 年 · 未来日期' : Number(year) === currentYear ? ' 年 · 当前年度' : ' 年');
  }
  function syncUrl() {
    try {
      var query = new URLSearchParams();
      if (state.view === 'comp') { query.set('view', 'comp'); if (state.no) query.set('no', state.no); }
      query.set('year', state.year || 'all');
      if (state.q) query.set('q', state.q);
      if (state.type) query.set('type', state.type);
      if (state.hide) query.set('review', 'hide');
      if (state.page > 1) query.set('page', String(state.page));
      history.replaceState(null, '', location.pathname + '?' + query.toString());
    } catch (e) { /* file:// may not support replaceState. */ }
  }
  function selected() {
    return events.filter(function (e) {
      return (!state.year || String(e.year) === state.year) &&
        (state.view !== 'comp' || String(e.no) === state.no) &&
        (!state.type || e.type === state.type) && (!state.hide || !e.verify) && C.matches(e, state.q);
    });
  }
  function record(e) {
    var yearStatus = e.year > currentYear ? '未来日期' : e.year === currentYear ? '当前年度' : '往届记录';
    var calendar = '../calendar/index.html?no=' + encodeURIComponent(e.no) + '&year=' + e.year;
    return '<article class="history-row"><div class="history-date"><time datetime="' + C.esc(e.start) + '">' + C.esc(e.start.slice(5)) + '</time><small>' + e.year + ' 年</small></div><div>' +
      '<div class="resource-meta"><span class="resource-label">' + C.esc(e.type) + '</span>' +
      (e.cat ? '<span>' + C.esc(e.cat) + '</span>' : '') + '<span>' + yearStatus + '</span>' +
      (e.verify ? '<span class="resource-label warning">待核实</span>' : '') + '</div>' +
      '<h3><a href="../calendar/index.html?no=' + encodeURIComponent(e.no) + '">' + C.esc(e.name) + '</a></h3>' +
      (e.title && e.title !== e.name ? '<p class="resource-description">' + C.esc(e.title) + '</p>' : '') +
      '<div class="resource-meta"><span>' + C.esc(e.org || '单位未标注') + '</span>' +
      (e.end && e.end !== e.start ? '<span>截至 ' + C.esc(e.end) + '</span>' : '') + '</div>' +
      '<div class="history-links">' + (C.safeUrl(e.source_url) ? C.external(e.source_url, '查看通知来源') : '<span>来源链接未收录</span>') +
      '<a href="' + C.esc(calendar) + '">在日历中查看</a></div>' +
      (e.quote ? '<details><summary>查看采集的原文片段</summary><blockquote>' + C.esc(e.quote) + '</blockquote></details>' : '') +
      '</div></article>';
  }
  function render() {
    $('compField').hidden = state.view !== 'comp';
    Array.from($('viewSwitch').querySelectorAll('button')).forEach(function (button) { button.setAttribute('aria-pressed', String(button.getAttribute('data-view') === state.view)); });
    $('yearFilter').value = state.year; $('compFilter').value = state.no;
    var rows = selected(), pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
    state.page = Math.max(1, Math.min(state.page, pageCount));
    var start = (state.page - 1) * pageSize, shown = rows.slice(start, start + pageSize), lastGroup = '';
    $('historyList').innerHTML = shown.map(function (event) {
      var key = event.start.slice(0, 7), header = '';
      if (lastGroup !== key) { header = '<h3 class="history-month">' + event.year + ' 年 ' + Number(event.start.slice(5, 7)) + ' 月</h3>'; lastGroup = key; }
      return header + record(event);
    }).join('');
    $('resultCount').textContent = '找到 ' + rows.length + ' 条记录';
    $('pageRange').textContent = rows.length ? '显示 ' + (start + 1) + '–' + (start + shown.length) + ' 条' : '';
    $('emptyState').hidden = rows.length !== 0;
    $('paging').hidden = rows.length <= pageSize;
    $('prevPage').disabled = state.page === 1; $('nextPage').disabled = state.page === pageCount;
    $('pageNumber').textContent = state.page + ' / ' + pageCount;
    $('compOverview').hidden = state.view !== 'comp';
    if (state.view === 'comp') {
      var comp = comps.filter(function (c) { return String(c.no) === state.no; })[0];
      var all = events.filter(function (e) { return String(e.no) === state.no; });
      var totalYears = new Set(all.map(function (e) { return e.year; })).size;
      $('compOverview').innerHTML = comp ? '<strong>' + C.esc(comp.name) + '</strong> · 全部年份共 ' + all.length + ' 条记录，涉及 ' + totalYears + ' 个年份。' : '未找到该赛事，请重新选择。';
    }
    syncUrl();
  }
  function reset() {
    state = { view: 'year', year: defaultYear, no: '', q: '', type: '', hide: false, page: 1 };
    $('searchInput').value = ''; $('typeFilter').value = ''; $('hideUnverified').checked = false; render();
  }
  function readQuery() {
    var p = new URLSearchParams(location.search);
    if (p.get('no') || p.get('view') === 'comp') {
      state.view = 'comp'; state.no = p.get('no') || (comps.length ? String(comps[0].no) : ''); state.year = '';
      if (state.no && !comps.some(function (c) { return String(c.no) === state.no; })) {
        var missing = document.createElement('option'); missing.value = state.no; missing.textContent = '未找到赛事 #' + state.no; $('compFilter').appendChild(missing);
      }
    }
    if (p.get('year') === 'all') state.year = '';
    else if (years.indexOf(p.get('year')) >= 0) state.year = p.get('year');
    state.q = p.get('q') || '';
    if (types.indexOf(p.get('type')) >= 0) state.type = p.get('type');
    state.hide = p.get('review') === 'hide';
    var requestedPage = Number(p.get('page'));
    if (Number.isFinite(requestedPage) && requestedPage > 0) state.page = Math.floor(requestedPage);
    $('searchInput').value = state.q; $('typeFilter').value = state.type; $('hideUnverified').checked = state.hide;
  }
  function fail() {
    $('resourceControls').hidden = true; $('emptyState').hidden = false;
    $('emptyTitle').textContent = '暂时没有可读取的竞赛记录';
    $('emptyText').textContent = '请刷新重试；若仍无法读取，请联系维护者检查数据文件。';
    $('emptyReset').hidden = true; $('resultCount').textContent = '资料暂不可用';
  }
  if (!HD || !C) { fail(); return; }
  HD.load({ base: '../../data/' }).then(function (data) {
    comps = data.comps;
    events = data.events.map(function (raw) {
      var start = typeof raw.start === 'string' ? raw.start.slice(0, 10) : '', date = HD.parseYMD(start);
      if (!date) return null;
      var end = typeof raw.end === 'string' ? raw.end.slice(0, 10) : '';
      if (!HD.parseYMD(end) || end < start) end = '';
      return { no: HD.normalizeNo(raw.no), name: raw.name || '未命名赛事', start: start, end: end,
        year: date.getFullYear(), cat: raw.cat || '', org: raw.org || '', type: raw.type || '其他',
        title: raw.title || '', quote: raw.quote || '', source_url: raw.source_url || '',
        verify: raw.verify === true || raw.verify === 'true' };
    }).filter(Boolean).sort(function (a, b) { return b.start.localeCompare(a.start) || a.no.localeCompare(b.no, undefined, { numeric: true }); });
    if (!data.eventsOk) { fail(); return; }
    years = Array.from(new Set(events.map(function (e) { return String(e.year); }))).sort().reverse();
    defaultYear = years.filter(function (year) { return Number(year) < currentYear; })[0] || years[0] || '';
    state.year = defaultYear;
    types = Array.from(new Set(events.map(function (e) { return e.type; }))).sort();
    $('yearFilter').innerHTML = '<option value="">全部年份</option>' + years.map(function (year) { return '<option value="' + year + '">' + yearLabel(year) + '</option>'; }).join('');
    $('typeFilter').innerHTML = '<option value="">全部类型</option>' + types.map(function (type) { return '<option value="' + C.esc(type) + '">' + C.esc(type) + '</option>'; }).join('');
    $('compFilter').innerHTML = '<option value="">请选择赛事</option>' + comps.map(function (comp) { return '<option value="' + C.esc(comp.no) + '">' + C.esc(comp.no + '. ' + comp.name) + '</option>'; }).join('');
    $('dataSummary').textContent = '共 ' + events.length + ' 条日期有效记录 · ' + years.length + ' 个年份';
    $('checkedDate').textContent = '采集更新 ' + HD.fmtDT((data.stats || {}).last_run || data.generated_at || '');
    readQuery();
    $('viewSwitch').addEventListener('click', function (e) {
      var button = e.target.closest('button[data-view]');
      if (!button || button.getAttribute('data-view') === state.view) return;
      state.view = button.getAttribute('data-view'); state.page = 1;
      if (state.view === 'comp') { state.year = ''; state.no = state.no || (comps.length ? String(comps[0].no) : ''); }
      else state.year = defaultYear;
      render();
    });
    [['yearFilter','year'],['typeFilter','type'],['compFilter','no']].forEach(function (pair) {
      $(pair[0]).addEventListener('change', function () { state[pair[1]] = this.value; state.page = 1; render(); });
    });
    $('searchInput').addEventListener('input', function () { state.q = this.value; state.page = 1; render(); });
    $('hideUnverified').addEventListener('change', function () { state.hide = this.checked; state.page = 1; render(); });
    $('resetFilters').addEventListener('click', reset); $('emptyReset').addEventListener('click', reset);
    [['prevPage',-1],['nextPage',1]].forEach(function (pair) {
      $(pair[0]).addEventListener('click', function () {
        state.page += pair[1]; render();
        $('resultCount').setAttribute('tabindex','-1'); $('resultCount').focus({ preventScroll: true });
        $('resultCount').scrollIntoView({ block: 'start' });
      });
    });
    render();
  }).catch(fail);
})();
