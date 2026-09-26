/* ==========================================================================
 * 赛事总览 — 纯前端逻辑（零依赖 / 零构建 / 零 CDN）
 *
 * 定位：纯聚合页。把官方名录里的竞赛**全部**列出来（A1–C 共 224 项，一项不少），
 *       每行只展示：赛事名、分级、适合人群、报名时间、举办/评比时间与官方入口按钮；
 *       不再提供单项赛事详情（详情页已于本版下线）。
 *
 * 数据：../../data/events.js + competitions.js（内嵌优先，http 下回退 fetch）
 *       ../../data/sources.json 仅用于推算「已抓 N 个来源」（file:// 下跳过）
 *       全部数字都由数据算出来，页面里没有任何写死的统计值。
 * ========================================================================== */
(function () {
  'use strict';

  var HD = window.HubData;

  /* 竞赛类别（学科分面）：分类体系与「赛事编号 → 子分类」映射来自 categories.js */
  var CATS_TAXONOMY = Array.isArray(window.__COMP_CATEGORY_TAXONOMY__) ? window.__COMP_CATEGORY_TAXONOMY__ : [];
  var CATS_MAP = window.__COMP_CATEGORY_MAP__ || {};
  var CATS_GROUP_OF = {};
  CATS_TAXONOMY.forEach(function (group) {
    (group.items || []).forEach(function (item) { CATS_GROUP_OF[item.id] = group.id; });
  });
  // 桌面默认展开分组；窄屏（≤820px）默认收起。只在初始化时取一次媒体查询结果。
  var CATS_OPEN_DEFAULT = !(window.matchMedia && window.matchMedia('(max-width: 820px)').matches);

  var state = {
    data: null,
    items: [],          // 全部 224 项（A1–C，含事件统计与 coverage）
    byNo: {},           // no → item（行点击打开抽屉时取数用）
    orgOptions: [],     // 校内单位下拉（按赛事数降序）
    audOptions: [],     // 面向对象下拉
    filters: { cat: '', org: '', aud: '', status: '', rankOnly: false, q: '', compcats: [] },
    catOpen: {},        // 分类分组的展开态（复位时回到 CATS_OPEN_DEFAULT）
    sort: 'no'
  };

  var el = {};
  function $(id) { return document.getElementById(id); }

  function cacheEls() {
    ['kpis', 'q', 'sortSel', 'catSeg', 'orgSel', 'audSel', 'statusSeg', 'onlyInfo',
      'rankOnly', 'btnReset', 'resultLine', 'coverageHint', 'compList', 'emptyState',
      'diag', 'footMeta', 'catPanel', 'catGroups', 'catSummary',
      'compOverlay', 'compDrawer'].forEach(function (id) { el[id] = $(id); });
  }

  /** 过滤后的分类 id 数组（空数组 = 该赛事无学科分类） */
  function subcatsOf(no) {
    var subs = CATS_MAP[no];
    return Array.isArray(subs) ? subs.slice() : [];
  }

  /* ---------------- 时间口径（纯文本行用） ---------------- */

  /** 报名类事件 / 举办评比类事件的类型集合（与日历页 TYPE_META 的 signup 口径一致） */
  var SIGNUP_TYPES = ['报名开始', '报名截止'];
  var RUN_TYPES = ['作品提交', '校赛', '省赛', '国赛'];

  /**
   * 周期选择规则：优先取「含今天或未来事件的最大年份」（这样行内看到的是正在进行 / 即将进行的
   * 那一届），若整场赛事全是历史事件，则退回「数据里的最大年份」。返回该年份的事件列表（已按 start 排序）。
   */
  function pickPeriod(st) {
    if (!st || !st.years || !st.years.length) return null;
    var tk = HD.todayKey();
    var years = st.years;                       // 已按升序排好
    var chosen = null;
    for (var i = years.length - 1; i >= 0; i--) {
      var list = st.byYear.get(years[i]) || [];
      var hasFuture = list.some(function (ev) { return String(ev.start || '').slice(0, 10) >= tk; });
      if (hasFuture) { chosen = years[i]; break; }
    }
    if (chosen === null) chosen = years[years.length - 1];
    return { year: chosen, events: (st.byYear.get(chosen) || []).slice() };
  }

  /**
   * 同一周期内某几类事件的时间窗口：「最早 start ~ 最晚 end」。
   * 只有一个日期（start == end）时只显示那个日期；没有命中事件返回 ''（调用方显示「暂未收录」）。
   */
  function windowOf(events, types) {
    var start = null, end = null;
    (events || []).forEach(function (ev) {
      if (types.indexOf(ev.type) < 0) return;
      var s = String(ev.start || '').slice(0, 10);
      if (!s) return;
      var e = String(ev.end || '').slice(0, 10) || s;
      if (e < s) e = s;
      if (start === null || s < start) start = s;
      if (end === null || e > end) end = e;
    });
    if (start === null) return '';
    return start === end ? start : start + ' ~ ' + end;
  }

  /* ---------------- 数据整形 ---------------- */

  /**
   * 把 competitions + events + coverage 合成渲染用的行数据。
   * 事件条数 / 首末日期：优先用 events 数据现算（与日历页看到的一致），
   * 这样「总览显示 N 条 → 点进日历也应该是 N 条」；
   * 只有当该赛事在 events 里查不到任何记录时，才退回 coverage.json 的预计算值。
   */
  function buildItems(data) {
    var evBy = HD.eventStatsByNo(data.events);
    var cov = (data.coverage && data.coverage.items) || {};
    return (data.comps || []).map(function (c) {
      var no = HD.normalizeNo(c.no);
      var st = evBy.get(no) || null;
      var ci = cov[no] || null;
      var hasEv = !!(st && st.count > 0);
      var count = hasEv ? st.count : (ci ? HD.num(ci.events, 0) : 0);
      var period = hasEv ? pickPeriod(st) : null;
      var periodEvents = period ? period.events : [];
      return {
        no: no,
        cat: c.cat || '',
        name: c.name || '(未命名赛事)',
        org: c.org || '',
        orgs: HD.competitionOrgs(c),
        aud: HD.audienceOf(c),
        rank: c.rank_list || '',
        host: c.host || '',
        note: c.note || '',
        links: c.links || {},
        evCount: count,
        first: hasEv ? st.first : (ci ? ci.first_event : null),
        last: hasEv ? st.last : (ci ? ci.last_event : null),
        next: hasEv ? st.next : (ci ? ci.next_event : null),
        years: hasEv ? st.years.slice() : ((ci && ci.years) ? ci.years : []),
        status: hasEv ? 'ok' : (ci ? ci.status : 'no_info'),
        sourceCount: ci ? ci.sources : null,
        // 该赛事是否有抓取侧记录（官方 coverage.json 命中 / sources 命中）；
        // C 类（185–224）本轮只收录名录、未抓来源，因此为 false，提示行改用「暂未收录时间信息」
        hasCoverage: !!(ci && ci.derived === false),
        periodYear: period ? period.year : null,
        signupText: windowOf(periodEvents, SIGNUP_TYPES),   // 报名开始 ~ 报名截止
        runText: windowOf(periodEvents, RUN_TYPES),         // 作品提交/校赛/省赛/国赛 最早 ~ 最晚
        subcats: subcatsOf(no),
        coverage: ci
      };
    });
  }

  /** 校内单位选项：拆多值单位，按赛事数降序 */
  function buildOrgOptions(items) {
    var cnt = {};
    items.forEach(function (it) {
      it.orgs.forEach(function (o) { cnt[o] = (cnt[o] || 0) + 1; });
    });
    return Object.keys(cnt).sort(function (a, b) {
      if (cnt[b] !== cnt[a]) return cnt[b] - cnt[a];
      return a < b ? -1 : (a > b ? 1 : 0);
    }).map(function (n) { return { name: n, count: cnt[n] }; });
  }

  function buildAudOptions(items) {
    var order = HD.AUDIENCES.concat([HD.AUDIENCE_UNKNOWN]);
    var cnt = {};
    items.forEach(function (it) { cnt[it.aud] = (cnt[it.aud] || 0) + 1; });
    return order.filter(function (a) { return cnt[a]; }).map(function (a) {
      return { name: a, count: cnt[a] };
    });
  }

  /* ---------------- 渲染 ---------------- */

  function renderKpis() {
    var items = state.items;
    var events = state.data ? state.data.events : [];
    var total = items.length;
    var withEv = items.filter(function (i) { return i.evCount > 0; }).length;
    var none = total - withEv;
    var years = {};
    events.forEach(function (e) {
      var y = HD.num(e.year, parseInt(String(e.start || '').slice(0, 4), 10));
      if (y) years[y] = true;
    });
    var ys = Object.keys(years).map(Number).sort(function (a, b) { return a - b; });
    var stats = (state.data && state.data.stats) || {};
    var evTotal = HD.num(stats.events, events.length);
    var srcTotal = state.data && state.data.sources ? state.data.sources.length : null;
    var srcSub = state.data && state.data.sources ? '条 sources.json 记录' : '本次运行未读到来源清单';

    // 有抓取管线产出的 coverage 时，来源总数以 coverage 汇总为准（口径与每行的「已抓 N 个来源」一致）
    var covItems = (state.data && state.data.coverage && state.data.coverage.items) || null;
    if (covItems) {
      var sum = 0, seen = 0;
      Object.keys(covItems).forEach(function (k) {
        var n = covItems[k] && covItems[k].sources;
        if (typeof n === 'number') { sum += n; seen++; }
      });
      if (seen) { srcTotal = sum; srcSub = '条来源（coverage.json 汇总）'; }
    }

    el.kpis.innerHTML =
      kpi('赛事总数', total, 'A1+A2+B1+B2+C 全清单', 'kpi-accent') +
      kpi('已抓到时间信息', withEv, '至少有一条事件', '') +
      kpi('暂无报名信息', none, '已抓来源尚无时间 / C 类暂未抓取', 'kpi-none') +
      kpi('事件条目', evTotal, '来自 events.json', '') +
      kpi('覆盖年份', ys.length ? (ys[0] + '–' + ys[ys.length - 1]) : '—',
        ys.length + ' 个年份有记录', '') +
      kpi('已抓来源记录', srcTotal === null ? '—' : srcTotal, srcSub, '');

    el.coverageHint.textContent = '事件 ' + evTotal + ' 条 · 「暂无报名信息」= 已抓来源尚无时间信息，或 C 类尚未抓取时间 · ' +
      '来源条数口径：' + (state.data ? state.data.coverageSource : '—');
  }

  function kpi(k, v, sub, cls) {
    return '<div class="kpi ' + (cls || '') + '">' +
      '<span class="kpi-k">' + HD.esc(k) + '</span>' +
      '<span class="kpi-v">' + HD.esc(v) + '</span>' +
      '<span class="kpi-sub">' + HD.esc(sub) + '</span>' +
      '</div>';
  }

  function renderOrgOptions() {
    var html = ['<option value="">全部单位</option>'];
    state.orgOptions.forEach(function (o) {
      html.push('<option value="' + HD.esc(o.name) + '">' + HD.esc(o.name) + '（' + o.count + ' 项）</option>');
    });
    el.orgSel.innerHTML = html.join('');
    el.orgSel.value = state.filters.org;
  }

  function renderAudOptions() {
    var html = ['<option value="">全部对象</option>'];
    state.audOptions.forEach(function (o) {
      html.push('<option value="' + HD.esc(o.name) + '">' + HD.esc(o.name) + '（' + o.count + ' 项）</option>');
    });
    el.audSel.innerHTML = html.join('');
    el.audSel.value = state.filters.aud;
  }

  /* ---------------- 竞赛类别侧栏（分类树） ---------------- */

  function catOpen(groupId) { return state.catOpen[groupId] !== false; }

  /** 侧栏 DOM 由 TAXONOMY 渲染：单一数据源，改分类体系只改 categories.js */
  function renderCatPanel() {
    if (!el.catGroups) return;
    if (!CATS_TAXONOMY.length) {
      el.catGroups.innerHTML = '<p class="cc-note">分类数据未载入（web/competitions/categories.js 缺失）。</p>';
      el.catSummary.textContent = '';
      return;
    }
    el.catGroups.innerHTML = CATS_TAXONOMY.map(function (group) {
      var open = catOpen(group.id);
      var items = (group.items || []).map(function (item) {
        return '<label class="cc-item"><input type="checkbox" value="' + HD.esc(item.id) + '">' +
          '<span class="cc-item-label">' + HD.esc(item.label) + '</span></label>';
      }).join('');
      return '<div class="cc-group">' +
        '<button type="button" class="cc-group-head" data-group="' + HD.esc(group.id) + '"' +
        ' aria-expanded="' + open + '" aria-controls="cc-group-' + HD.esc(group.id) + '">' +
        '<span class="cc-group-name">' + HD.esc(group.label) + '</span>' +
        '<span class="cc-group-badge" data-badge="' + HD.esc(group.id) + '" hidden>0</span>' +
        '<span class="cc-arrow" aria-hidden="true">▾</span>' +
        '</button>' +
        '<div class="cc-items" id="cc-group-' + HD.esc(group.id) + '"' + (open ? '' : ' hidden') + '>' +
        items + '</div>' +
        '</div>';
    }).join('');
    syncCatPanel();
  }

  /** 勾选态 / 分组徽标 / 展开态 / 顶部「已选 N 项 · 清除」全部按 state 回填 */
  function syncCatPanel() {
    if (!el.catGroups) return;
    var chosen = state.filters.compcats;
    Array.prototype.forEach.call(el.catGroups.querySelectorAll('input[type="checkbox"]'), function (box) {
      box.checked = chosen.indexOf(box.value) >= 0;
    });
    var perGroup = {};
    chosen.forEach(function (id) {
      var gid = CATS_GROUP_OF[id];
      if (gid) perGroup[gid] = (perGroup[gid] || 0) + 1;
    });
    CATS_TAXONOMY.forEach(function (group) {
      var open = catOpen(group.id);
      var head = el.catGroups.querySelector('.cc-group-head[data-group="' + group.id + '"]');
      if (head) head.setAttribute('aria-expanded', String(open));
      var box = document.getElementById('cc-group-' + group.id);
      if (box) box.hidden = !open;
      var badge = el.catGroups.querySelector('[data-badge="' + group.id + '"]');
      var n = perGroup[group.id] || 0;
      if (badge) { badge.textContent = String(n); badge.hidden = n === 0; }
    });
    el.catSummary.innerHTML = '已选 <b>' + chosen.length + '</b> 项' +
      (chosen.length ? ' · <button type="button" class="cc-clear" id="catClear">清除</button>' : '');
  }

  function setCatOpen(open) {
    CATS_TAXONOMY.forEach(function (group) { state.catOpen[group.id] = open; });
  }

  /* ---------------- 筛选 / 排序 ---------------- */

  function filterItems() {
    var f = state.filters;
    var q = (f.q || '').trim().toLowerCase();
    return state.items.filter(function (it) {
      if (f.cat && it.cat !== f.cat) return false;
      if (f.org && it.orgs.indexOf(f.org) < 0) return false;
      if (f.aud && it.aud !== f.aud) return false;
      if (f.rankOnly && it.rank !== '是') return false;
      if (f.status === 'ok' && it.evCount === 0) return false;
      if (f.status === 'none' && it.evCount > 0) return false;
      // 竞赛类别：维度内 OR（命中任一子分类即可），与其他维度 AND
      if (f.compcats.length) {
        var hit = f.compcats.some(function (id) { return it.subcats.indexOf(id) >= 0; });
        if (!hit) return false;
      }
      if (q) {
        var hay = (it.name + '\n' + it.org + '\n' + it.orgs.join(' ') + '\n' + it.host + '\n' +
          it.note + '\n' + it.no).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  function sortItems(list) {
    var s = state.sort;
    var out = list.slice();
    out.sort(function (a, b) {
      if (s === 'events') {
        if (b.evCount !== a.evCount) return b.evCount - a.evCount;
        return HD.cmpNo(a.no, b.no);
      }
      if (s === 'last') {
        var la = a.last || '', lb = b.last || '';
        if (la !== lb) return lb > la ? 1 : -1;   // 有日期的排前面，新的在前
        return HD.cmpNo(a.no, b.no);
      }
      if (s === 'name') return a.name.localeCompare(b.name, 'zh-Hans-CN');
      return HD.cmpNo(a.no, b.no);
    });
    return out;
  }

  /* ---------------- 行渲染 ---------------- */

  function noneNote(it) {
    // C 类（185–224）本轮只收录官方名录、未抓取来源：统一给中性文案，不说成「已抓 0 个来源」
    if (!it.hasCoverage) return '该赛事尚未抓取来源，暂未收录时间信息。';
    return HD.coverageNote(it.coverage || { sources: it.sourceCount, status: it.status });
  }

  /** 官方入口：signup → official → host_page 第一个通过安全检查的 http(s) 链接 */
  function entryLink(links) {
    var order = ['signup', 'official', 'host_page'];
    for (var i = 0; i < order.length; i++) {
      var list = links && links[order[i]];
      if (!Array.isArray(list)) continue;
      for (var j = 0; j < list.length; j++) {
        var item = list[j] || {};
        var url = HD.safeUrl(item.url);
        if (url) return { url: url, label: item.name || '' };
      }
    }
    return null;
  }

  /** 一行 = 赛事名（纯文本）+ 分级徽章 + 适合人群 + 报名时间 + 举办/评比时间 + 官方入口按钮 */
  function rowHtml(it) {
    var isNone = it.evCount === 0;
    var catCls = HD.catClass(it.cat);

    var badges = '<span class="cat-badge ' + catCls + '" title="' + HD.esc(HD.CAT_LABEL[it.cat] || it.cat) + '">' +
      HD.esc(it.cat || '—') + '</span>';

    var fields = '<div class="cr-fields">' +
      '<span class="cr-field"><span class="cf-k">适合人群：</span><span class="cf-v">' + HD.esc(it.aud) + '</span></span>' +
      '<span class="cr-field"><span class="cf-k">报名时间：</span><span class="cf-v mono">' +
        (it.signupText ? HD.esc(it.signupText) : '暂未收录') + '</span></span>' +
      '<span class="cr-field"><span class="cf-k">举办/评比时间：</span><span class="cf-v mono">' +
        (it.runText ? HD.esc(it.runText) : '暂未收录') + '</span></span>' +
      '</div>';

    var noneLine = isNone
      ? '<div class="cr-none" title="' + HD.esc(noneNote(it)) + '">' +
          '<span class="none-flag">' + (it.hasCoverage ? '暂无报名信息' : '暂无时间信息') + '</span> ' +
          HD.esc(noneNote(it)) + '</div>'
      : '';

    var entry = entryLink(it.links);
    var action = entry
      ? '<a class="btn ghost cr-btn" href="' + HD.esc(entry.url) + '" target="_blank" rel="noopener noreferrer"' +
        (entry.label ? ' title="' + HD.esc(entry.label) + '"' : '') + '>官方报名/通知</a>'
      : '';

    var title = it.name + '（' + (it.cat || '未分类') + '）\n' +
      '适合人群：' + it.aud + '\n' +
      '报名时间：' + (it.signupText || '暂未收录') + '\n' +
      '举办/评比时间：' + (it.runText || '暂未收录') + '\n' +
      (it.periodYear ? '时间口径：' + it.periodYear + ' 年度周期\n' : '') +
      (isNone ? noneNote(it) : '事件 ' + it.evCount + ' 条；涉及年份 ' + (it.years.join('、') || '—')) +
      '\n点击查看详情';

    return '<div class="comp-row' + (isNone ? ' is-none' : '') + '" role="listitem" tabindex="0"' +
      ' aria-haspopup="dialog" data-no="' + HD.esc(it.no) +
      '" data-cat="' + HD.esc(it.cat) + '" data-aud="' + HD.esc(it.aud) + '" data-status="' + (isNone ? 'none' : 'ok') +
      '" data-events="' + it.evCount + '" data-org="' + HD.esc(it.org) + '">' +
      '<div class="cr-no" title="赛事编号">#' + HD.esc(it.no) + '</div>' +
      '<div class="cr-main">' +
        '<div class="cr-title">' +
          '<span class="cr-name" title="' + HD.esc(title) + '">' + HD.esc(it.name) + '</span>' +
          badges +
        '</div>' +
        fields +
        noneLine +
      '</div>' +
      (action ? '<div class="cr-actions">' + action + '</div>' : '') +
      '</div>';
  }

  function renderList() {
    var all = state.items;
    var list = sortItems(filterItems());
    var noneShown = list.filter(function (i) { return i.evCount === 0; }).length;

    el.resultLine.innerHTML = '显示 <b>' + list.length + '</b> / ' + all.length + ' 项赛事' +
      (list.length ? ' · 其中 <b>' + noneShown + '</b> 项暂无时间信息' : '');

    if (!list.length) {
      el.compList.innerHTML = '';
      el.emptyState.hidden = false;
      return;
    }
    el.emptyState.hidden = true;
    el.compList.innerHTML = list.map(rowHtml).join('');
  }

  /* ---------------- 右侧详情抽屉（结构 / 交互对齐竞赛日历页） ----------------
   * 打开：填内容 → 显示 → 锁定 body 滚动 → 聚焦关闭按钮；关闭：反向 + 焦点还原到来源行。
   * 内容全部来自已加载数据的事实字段，零解析、零主观评价。
   */

  /** 链接分组：与日历页 LINK_KINDS 完全一致（官网 / 报名入口 / 承办·通知） */
  var LINK_KINDS = [
    { key: 'official', label: '官网' },
    { key: 'signup', label: '报名入口' },
    { key: 'host_page', label: '承办/通知' }
  ];

  var lastTrigger = null;   // 打开抽屉的行元素，关闭时把焦点还回去

  function drawerOpen() { return !!(el.compDrawer && !el.compDrawer.hidden); }

  /** 「该赛事的其他链接」：分组列出名称 + 链接（紧凑实现，形制对齐日历页 linkBlocksHtml） */
  function drawerLinkBlocks(it) {
    var links = it.links || {};
    var out = [];
    LINK_KINDS.forEach(function (k) {
      var arr = Array.isArray(links[k.key]) ? links[k.key] : [];
      if (!arr.length) return;
      out.push('<div class="link-block"><div class="lb-title">' + k.label + '（' + arr.length + '）</div><ul class="link-list">' +
        arr.map(function (l) {
          var raw = l && l.url ? String(l.url) : '';
          var url = HD.safeUrl(raw);                       // 只有通过安全校验的 http(s) 才渲染成链接
          var nm = l && l.name ? String(l.name) : raw;
          if (!url) return '<li><span class="lk-kind">' + k.label + '</span><span>' + HD.esc(nm) + '（链接未收录）</span></li>';
          return '<li><span class="lk-kind">' + k.label + '</span>' +
            '<a href="' + HD.esc(url) + '" target="_blank" rel="noopener noreferrer">' + HD.esc(nm) + '</a></li>';
        }).join('') + '</ul></div>');
    });
    if (!out.length) return '<p class="empty-hint">暂无收录链接</p>';
    return out.join('');
  }

  function drawerHtml(it) {
    var isNone = it.evCount === 0;
    var catCls = HD.catClass(it.cat);
    var catTitle = HD.CAT_LABEL[it.cat] || (it.cat || '未分类');
    var rankText = it.rank === '是'
      ? '是 <span class="badge soft">中国高等教育学会排行榜</span>'
      : (it.rank ? HD.esc(it.rank) : '—');
    var entry = entryLink(it.links);

    // 事件条目 / 来源记录：与行内、KPI 同一口径（C 类未抓取 → 直说未抓取）
    var evText = isNone ? '0 条（暂无时间信息）'
      : (it.evCount + ' 条' + (it.years.length ? '　涉及年份 ' + HD.esc(it.years.join('、')) : ''));
    var srcText = (typeof it.sourceCount === 'number' && it.hasCoverage)
      ? (it.sourceCount + ' 条来源记录')
      : '尚未抓取来源';

    return '' +
      '<div class="drawer-head">' +
        '<div>' +
          '<div class="d-badges">' +
            '<span class="badge cat ' + catCls + '">' + HD.esc(it.cat || '—') + ' 类</span>' +
            '<span class="badge soft">面向 ' + HD.esc(it.aud) + '</span>' +
          '</div>' +
          '<h2 id="compDrawerTitle">' + HD.esc(it.name) + '</h2>' +
        '</div>' +
        '<button type="button" class="drawer-close" id="compDrawerClose" aria-label="关闭">✕</button>' +
      '</div>' +
      '<div class="drawer-body">' +
        '<dl class="d-grid">' +
          '<dt>赛事编号</dt><dd>#' + HD.esc(it.no) + (it.cat ? '　（' + HD.esc(it.cat) + ' 类）' : '') + '</dd>' +
          '<dt>官方分级</dt><dd>' + HD.esc(catTitle) + '</dd>' +
          '<dt>校内单位</dt><dd>' + HD.esc(it.org || '未标注') + '</dd>' +
          '<dt>主办单位</dt><dd>' + HD.esc(it.host || '未标注') + '</dd>' +
          '<dt>适合人群</dt><dd>' + HD.esc(it.aud) + '</dd>' +
          '<dt>列入排行榜</dt><dd>' + rankText + '</dd>' +
          '<dt>报名时间</dt><dd class="mono">' + HD.esc(it.signupText || '暂未收录') + '</dd>' +
          '<dt>举办/评比时间</dt><dd class="mono">' + HD.esc(it.runText || '暂未收录') +
            (it.periodYear ? '　（' + HD.esc(String(it.periodYear)) + ' 年度周期）' : '') + '</dd>' +
          '<dt>事件条目</dt><dd>' + evText + '</dd>' +
          '<dt>来源记录数</dt><dd>' + srcText + '</dd>' +
        '</dl>' +
        '<div class="d-sec"><h3>官方报名 / 通知</h3>' +
          '<div class="d-actions">' +
            (entry
              ? '<a class="btn primary" href="' + HD.esc(entry.url) + '" target="_blank" rel="noopener noreferrer">官方报名/通知 ↗</a>' +
                (entry.label ? '<span class="drawer-link-name">' + HD.esc(entry.label) + '</span>' : '')
              : '<button type="button" class="btn" disabled>暂无可用入口</button>') +
          '</div>' +
          (entry ? '' : '<p class="empty-hint" style="margin-top:6px">该赛事暂未收录官方报名 / 通知链接。</p>') +
        '</div>' +
        '<div class="d-sec"><h3>该赛事的其他链接</h3>' + drawerLinkBlocks(it) + '</div>' +
      '</div>';
  }

  function openCompDrawer(it, trigger) {
    if (!el.compDrawer || !it) return;
    lastTrigger = trigger || null;
    el.compDrawer.innerHTML = drawerHtml(it);
    el.compDrawer.hidden = false;
    if (el.compOverlay) el.compOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
    var closeBtn = el.compDrawer.querySelector('.drawer-close');
    if (closeBtn) closeBtn.focus();
  }

  function closeCompDrawer() {
    if (!el.compDrawer || el.compDrawer.hidden) return;
    el.compDrawer.hidden = true;
    if (el.compOverlay) el.compOverlay.hidden = true;
    el.compDrawer.innerHTML = '';
    document.body.style.overflow = '';
    if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
    lastTrigger = null;
  }

  /** 行元素 → item（state.byNo 由 init 一次性建好） */
  function itemOfRow(row) {
    if (!row) return null;
    return state.byNo[HD.normalizeNo(row.getAttribute('data-no'))] || null;
  }

  /* ---------------- 交互 ---------------- */

  function syncSeg(seg, attr, value) {
    Array.prototype.forEach.call(seg.querySelectorAll('button'), function (b) {
      var on = b.getAttribute(attr) === value;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }

  function syncUI() {
    syncSeg(el.catSeg, 'data-cat', state.filters.cat);
    syncSeg(el.statusSeg, 'data-status', state.filters.status);
    el.orgSel.value = state.filters.org;
    el.audSel.value = state.filters.aud;
    el.rankOnly.checked = state.filters.rankOnly;
    el.onlyInfo.checked = state.filters.status === 'ok';
    el.sortSel.value = state.sort;
    if (el.q.value !== state.filters.q) el.q.value = state.filters.q;
  }

  function bindEvents() {
    var timer = null;
    el.q.addEventListener('input', function () {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        state.filters.q = el.q.value || '';
        renderList();
      }, 120);
    });

    el.catSeg.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-cat]');
      if (!b) return;
      state.filters.cat = b.getAttribute('data-cat');
      syncUI(); renderList();
    });

    el.statusSeg.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-status]');
      if (!b) return;
      state.filters.status = b.getAttribute('data-status');
      syncUI(); renderList();
    });

    el.orgSel.addEventListener('change', function () {
      state.filters.org = el.orgSel.value;
      renderList();
    });
    el.audSel.addEventListener('change', function () {
      state.filters.aud = el.audSel.value;
      renderList();
    });
    el.sortSel.addEventListener('change', function () {
      state.sort = el.sortSel.value;
      renderList();
    });

    // 「只看有信息的」= 状态切到 有事件；关掉则回到全部
    el.onlyInfo.addEventListener('change', function () {
      state.filters.status = el.onlyInfo.checked ? 'ok' : '';
      syncUI(); renderList();
    });
    el.rankOnly.addEventListener('change', function () {
      state.filters.rankOnly = el.rankOnly.checked;
      renderList();
    });

    el.btnReset.addEventListener('click', function () {
      state.filters = { cat: '', org: '', aud: '', status: '', rankOnly: false, q: '', compcats: [] };
      state.sort = 'no';
      setCatOpen(CATS_OPEN_DEFAULT);   // 分组展开态复位为初始默认
      syncCatPanel();
      syncUI(); renderList();
    });

    // 竞赛类别侧栏：分组展开/收起 + 子分类勾选（事件委托，DOM 由 renderCatPanel 生成）
    el.catGroups.addEventListener('click', function (e) {
      var head = e.target.closest('.cc-group-head');
      if (!head) return;
      var gid = head.getAttribute('data-group');
      state.catOpen[gid] = !catOpen(gid);
      syncCatPanel();
    });
    el.catGroups.addEventListener('change', function (e) {
      var box = e.target;
      if (!box || box.type !== 'checkbox') return;
      var chosen = state.filters.compcats.slice();
      var at = chosen.indexOf(box.value);
      if (box.checked && at < 0) chosen.push(box.value);
      else if (!box.checked && at >= 0) chosen.splice(at, 1);
      state.filters.compcats = chosen;
      syncCatPanel();
      renderList();
    });
    el.catSummary.addEventListener('click', function (e) {
      if (!e.target.closest('#catClear')) return;
      state.filters.compcats = [];
      syncCatPanel();
      renderList();
    });

    // 整行点击 → 右侧详情抽屉；行内链接 / 按钮（官方报名/通知）各自优先，不打开抽屉
    el.compList.addEventListener('click', function (e) {
      if (e.target.closest('a, button')) return;
      var row = e.target.closest('.comp-row');
      var it = itemOfRow(row);
      if (it) openCompDrawer(it, row);
    });
    // 键盘：焦点在行上时 Enter / Space 打开抽屉
    el.compList.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (e.target.closest('a, button')) return;
      var row = e.target.closest('.comp-row');
      if (!row || e.target !== row) return;       // 只响应落在行本身上的按键
      var it = itemOfRow(row);
      if (!it) return;
      e.preventDefault();
      openCompDrawer(it, row);
    });

    // 抽屉关闭：× 按钮 / 点遮罩 / Esc（与日历页一致）
    if (el.compDrawer) {
      el.compDrawer.addEventListener('click', function (e) {
        if (e.target.closest('.drawer-close')) closeCompDrawer();
      });
    }
    if (el.compOverlay) el.compOverlay.addEventListener('click', closeCompDrawer);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawerOpen()) closeCompDrawer();
    });
  }

  /* ---------------- 启动 ---------------- */

  function showDiag(data) {
    if (data.eventsOk && data.compsOk) { el.diag.hidden = true; return; }
    el.diag.hidden = false;
    el.diag.textContent = '数据加载诊断：\n' + (data.diag || []).join('\n') +
      '\n提示：file:// 直接双击时只能读内嵌数据；服务方式请确认 data/events.js、data/competitions.js 已生成。';
  }

  function init() {
    cacheEls();
    setCatOpen(CATS_OPEN_DEFAULT);
    renderCatPanel();
    bindEvents();

    if (!HD) {
      el.resultLine.textContent = '页面脚本缺失：web/hub-data.js 未加载。';
      return;
    }

    HD.load({ base: '../../data/' }).then(function (data) {
      state.data = data;
      state.items = buildItems(data);
      state.byNo = {};
      state.items.forEach(function (it) { state.byNo[it.no] = it; });
      state.orgOptions = buildOrgOptions(state.items);
      state.audOptions = buildAudOptions(state.items);

      renderKpis();
      renderOrgOptions();
      renderAudOptions();
      syncUI();
      renderList();
      showDiag(data);

      var stats = data.stats || {};
      el.footMeta.textContent = '赛事 ' + state.items.length + ' 项 · 事件 ' + data.events.length + ' 条 · 最近运行 ' +
        HD.fmtDT(stats.last_run || data.generated_at || '');
    }).catch(function (err) {
      el.resultLine.textContent = '数据加载失败：' + (err && err.message ? err.message : String(err));
      el.diag.hidden = false;
      el.diag.textContent = String(err && err.stack ? err.stack : err);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
