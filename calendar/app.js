/* ==========================================================================
 * 武汉科技大学学生学科和科技竞赛日历 — 纯前端逻辑
 * 零依赖 / 零构建 / 零 CDN；数据来自 ../../data/events.json 与 ../../data/competitions.json
 *
 * 结构：① 常量与工具函数 ② 纯逻辑核心（可在 Node 中单测） ③ 渲染层 ④ 事件绑定与初始化
 * ========================================================================== */
(function () {
  'use strict';

  /* ======================================================================
   * ① 常量
   * ==================================================================== */

  var CATS = ['A1', 'A2', 'B1', 'B2'];
  var OTHER_CAT = '其他';   // 契约外的类别统一归到“其他”，仍可在筛选栏中显示，避免事件凭空消失

  var TYPES = ['报名开始', '报名截止', '作品提交', '校赛', '省赛', '国赛', '结果公布', '培训会议', '其他'];

  /** 事件类型 → 图标 / CSS 键 / 排序权重 / 是否属于“报名相关” */
  var TYPE_META = {
    '报名开始': { icon: '▶', key: 'signup-start', prio: 1, signup: true },
    '报名截止': { icon: '⏰', key: 'signup-end', prio: 0, signup: true },
    '作品提交': { icon: '📄', key: 'submit', prio: 2, signup: false },
    '校赛': { icon: '🏆', key: 'school', prio: 3, signup: false, short: '校' },
    '省赛': { icon: '🏆', key: 'province', prio: 4, signup: false, short: '省' },
    '国赛': { icon: '🏆', key: 'national', prio: 5, signup: false, short: '国' },
    '结果公布': { icon: '✅', key: 'result', prio: 6, signup: false },
    '培训会议': { icon: '🎓', key: 'training', prio: 7, signup: false },
    '其他': { icon: '📌', key: 'other', prio: 8, signup: false }
  };

  var LINK_KINDS = [
    { key: 'official', label: '官网' },
    { key: 'signup', label: '报名入口' },
    { key: 'host_page', label: '承办/通知' }
  ];

  var WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  var MONTH_CELLS = 42;          // 6 周 × 7 天，保证布局稳定
  var MAX_CHIPS_PER_DAY = 3;     // 月视图中每格最多显示的事件数
  var MAX_SPAN_DAYS = 366;       // 跨天事件的区间保护上限
  var DEADLINE_WINDOW = 14;      // “今天之后 N 天内的报名截止”

  /**
   * 长区间阈值：跨度 > 7 天的事件（如「2026年大赛举办期」4/1~11/30，共 244 天）
   * 在月视图里只在首日（起）与末日（止）各出现一次，中间任何一天都不再生成条目，
   * 避免整月每一格都被同一个事件刷屏；≤7 天的区间仍逐日显示。议程列表两者都只出现一次。
   */
  var LONG_SPAN_LIMIT = 7;

  /** 面向对象：来自 competitions.json 的 audience 字段；空串 / 无赛事档案统一归入“未标注” */
  var AUDIENCES = ['本科生', '研究生', '全校学生', '未标注'];
  var AUDIENCE_UNKNOWN = '未标注';

  /** 核心档位快捷标签：A1 = 教育部 / 共青团中央等牵头的顶级赛事；A2 = 排行榜及研究生创新实践系列重大赛事 */
  var CORE_CATS = ['A1', 'A2'];

  var EMPTY_HINT = '暂无数据，请先运行 crawler/pipeline.py';

  /* ======================================================================
   * ② 纯逻辑核心（无 DOM 依赖，可被 Node 直接 require 做单元测试）
   * ==================================================================== */

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /** 防御性取 Date：拿到非 Date（null/字符串/Invalid Date）时回退到今天，避免调用方把页面搞崩 */
  function asDate(dt) {
    if (dt && typeof dt.getFullYear === 'function' && !isNaN(dt.getTime())) return dt;
    return new Date();
  }

  /** 'YYYY-MM-DD' → 本地时区当天 00:00 的 Date；非法则返回 null（避免 UTC 偏移陷阱） */
  function parseYMD(s) {
    if (typeof s !== 'string') return null;
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s.trim());
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    var dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    return dt;
  }

  /** Date → 'YYYY-MM-DD' */
  function ymd(dt) {
    var d = asDate(dt);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function startOfMonth(dt) { var d = asDate(dt); return new Date(d.getFullYear(), d.getMonth(), 1); }

  function addDays(dt, n) {
    var d = asDate(dt);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + (Number(n) || 0));
  }

  function addMonths(dt, n) {
    var d = asDate(dt);
    return new Date(d.getFullYear(), d.getMonth() + (Number(n) || 0), 1);
  }

  /** 周一 = 0 … 周日 = 6 */
  function weekdayIndex(dt) { return (asDate(dt).getDay() + 6) % 7; }

  function daysBetween(a, b) {
    var da = asDate(a), db = asDate(b);
    return Math.round((db.getTime() - da.getTime()) / 86400000);
  }

  function todayDate() {
    var n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }

  function typeMeta(t) { return TYPE_META[t] || { icon: '📌', key: 'other', prio: 9, signup: false }; }

  /** 类别 → CSS 类名（契约外的类别用中性灰 cat-other，避免中文类名） */
  function catClass(cat) { return CATS.indexOf(cat) >= 0 ? 'cat-' + cat : 'cat-other'; }

  /** 数据里出现、但不在 A1~B2 契约内的类别（如“其他”），用于动态补一个筛选芯片 */
  function extraCats(events) {
    var seen = {};
    (events || []).forEach(function (ev) {
      if (ev && ev.cat && CATS.indexOf(ev.cat) < 0) seen[ev.cat] = true;
    });
    return Object.keys(seen).sort();
  }

  /**
   * 拆分「校内组织单位」。org 可能是多值，用顿号连接：
   *   "理学院、管理学院" / "机械工程学院、材料学部、计算机科学与技术学院"
   * 规则：
   *   ① 先按 、 ， ; ； / | 拆分；
   *   ② 每个片段若还能用空白再分成多段、且每段都 ≥3 字，则视为多个单位
   *      （"资源与环境工程学院 材料学部" → 两个单位）；
   *   ③ 否则把片段内的空白合并掉，与库里的标准写法合流
   *      （"工程实践创新 中心" → "工程实践创新中心"）。
   * 结果已去重，且保持原顺序。
   */
  function splitOrg(raw) {
    if (raw === null || raw === undefined) return [];
    var text = String(raw).trim();
    if (!text) return [];
    var out = [];
    function add(name) { if (name && out.indexOf(name) < 0) out.push(name); }
    text.split(/[、,，;；\/|]+/).forEach(function (part) {
      var bits = part.trim().split(/\s+/).filter(function (b) { return !!b; });
      if (!bits.length) return;
      var splittable = bits.length > 1 && bits.every(function (b) { return b.length >= 3; });
      if (splittable) bits.forEach(add);
      else add(bits.join(''));
    });
    return out;
  }

  /** 事件涉及的校内单位数组 */
  function eventOrgs(ev) { return splitOrg(ev && ev.org); }

  /** 事件是否命中已选单位集合（一个事件命中任一个选中单位即算命中）；集合为空 = 不限制（全部单位） */
  function matchesOrgs(ev, orgSet) {
    if (!orgSet || typeof orgSet.has !== 'function' || orgSet.size === 0) return true;
    var units = eventOrgs(ev);
    for (var i = 0; i < units.length; i++) { if (orgSet.has(units[i])) return true; }
    return false;
  }

  /** 从事件里统计出全部校内单位，按事件数降序、同频次按名称升序 */
  function buildOrgOptions(events) {
    var count = {};
    (events || []).forEach(function (ev) {
      eventOrgs(ev).forEach(function (u) { count[u] = (count[u] || 0) + 1; });
    });
    return Object.keys(count).sort(function (a, b) {
      if (count[b] !== count[a]) return count[b] - count[a];
      return a < b ? -1 : (a > b ? 1 : 0);
    }).map(function (name) { return { name: name, count: count[name] }; });
  }

  /** 事件的面向对象：按 no 查赛事档案的 audience，缺失 / 空串归“未标注” */
  function audienceOf(comp) {
    var a = comp && comp.audience !== null && comp.audience !== undefined ? String(comp.audience).trim() : '';
    return a || AUDIENCE_UNKNOWN;
  }

  /** 事件是否命中已选面对象集合；集合为空或包含全部选项 = 不限制 */
  function matchesAudience(ev, audSet, compByNo) {
    if (!audSet || typeof audSet.has !== 'function' || audSet.size === 0) return true;
    var comp = (compByNo && typeof compByNo.get === 'function') ? compByNo.get(String(ev && ev.no)) : null;
    return audSet.has(audienceOf(comp));
  }

  /** 是否为“长区间”事件（跨度 > 7 天） */
  function isLongSpan(ev) { return !!(ev && (ev._span || 1) > LONG_SPAN_LIMIT); }

  /** ISO 时间串安全格式化（不依赖 Date 解析时区） */
  function fmtDateTime(s) {
    if (typeof s !== 'string' || !s) return '—';
    var m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(s);
    if (m) return m[1] + '-' + m[2] + '-' + m[3] + ' ' + m[4] + ':' + m[5];
    return s;
  }

  function fmtDateCN(key) {
    var d = parseYMD(key);
    if (!d) return key || '—';
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  function weekdayCN(key) {
    var d = parseYMD(key);
    return d ? WEEKDAYS[weekdayIndex(d)] : '';
  }

  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** 规范化一条原始事件；字段缺失/日期非法时返回 null（会被安全丢弃） */
  function normalizeEvent(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var start = parseYMD(raw.start);
    if (!start) return null;
    var end = parseYMD(raw.end);
    if (end && end.getTime() < start.getTime()) end = start;
    var span = end ? daysBetween(start, end) + 1 : 1;
    if (span > MAX_SPAN_DAYS) span = MAX_SPAN_DAYS;
    var cat = CATS.indexOf(raw.cat) >= 0 ? raw.cat : '其他';
    var type = TYPE_META[raw.type] ? raw.type : '其他';
    var conf = typeof raw.confidence === 'number' && isFinite(raw.confidence)
      ? Math.max(0, Math.min(1, raw.confidence)) : null;
    return {
      id: raw.id != null && raw.id !== '' ? String(raw.id) : (String(raw.no || '?') + '-' + ymd(start) + '-' + type),
      no: raw.no != null ? String(raw.no) : '',
      name: raw.name || '(未命名赛事)',
      cat: cat,
      org: raw.org || '',
      type: type,
      title: raw.title || '',
      start: ymd(start),
      end: end ? ymd(end) : null,
      year: typeof raw.year === 'number' ? raw.year : start.getFullYear(),
      source_url: raw.source_url || '',
      source_name: raw.source_name || '',
      source_kind: raw.source_kind || '',
      confidence: conf,
      quote: raw.quote || '',
      crawled_at: raw.crawled_at || '',
      _start: start,
      _end: end || start,
      _span: span
    };
  }

  /** 是否“报名相关” */
  function isSignupEvent(ev) {
    return !!(TYPE_META[ev.type] && TYPE_META[ev.type].signup);
  }

  /**
   * 按筛选条件过滤事件（单次线性遍历，不做 DOM 操作）
   * filters: {cats:Set, types:Set, orgs:Set, audiences:Set, compByNo:Map,
   *           year:'all'|number, signupOnly:boolean, keyword:string, compNo:string}
   * 说明：orgs / audiences 为空集（或未提供）时视为“不限制”，避免出现空日历。
   *       compNo 是深链 ?no=<赛事编号> 用的“只看某个赛事”过滤（空串 = 不限制）。
   */
  function filterEvents(events, filters) {
    var out = [];
    var kw = (filters.keyword || '').trim().toLowerCase();
    var compNo = filters.compNo ? String(filters.compNo) : '';
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      if (compNo && String(ev.no) !== compNo) continue;
      if (filters.cats && !filters.cats.has(ev.cat)) continue;
      if (filters.types && !filters.types.has(ev.type)) continue;
      if (filters.year !== 'all' && filters.year != null && ev.year !== filters.year) continue;
      if (!matchesOrgs(ev, filters.orgs)) continue;
      if (!matchesAudience(ev, filters.audiences, filters.compByNo)) continue;
      if (filters.signupOnly && !isSignupEvent(ev)) continue;
      if (kw) {
        var hay = (ev.name + '\n' + ev.title + '\n' + ev.quote + '\n' + ev.org + '\n' + ev.source_name + '\n' + ev.no).toLowerCase();
        if (hay.indexOf(kw) === -1) continue;
      }
      out.push(ev);
    }
    return out;
  }

  /** 同一格内的排序：类型权重 → 置信度 → 起始日期 → 名称（入参为索引条目或裸事件均可） */
  function compareEntries(a, b) {
    var ea = (a && a.ev) ? a.ev : a;
    var eb = (b && b.ev) ? b.ev : b;
    if (!ea || !eb) return 0;
    var pa = typeMeta(ea.type).prio, pb = typeMeta(eb.type).prio;
    if (pa !== pb) return pa - pb;
    var ca = ea.confidence == null ? -1 : ea.confidence;
    var cb = eb.confidence == null ? -1 : eb.confidence;
    if (ca !== cb) return cb - ca;
    if (ea.start !== eb.start) return ea.start < eb.start ? -1 : 1;
    return ea.name < eb.name ? -1 : (ea.name > eb.name ? 1 : 0);
  }

  /**
   * 一次性建立“日期 → 事件条目”索引。
   * - 单日 / 跨度 ≤ 7 天的区间：区间内每一天都生成一个条目，带 pos: start|mid|end|single 与 dayIndex；
   * - 跨度 > 7 天的长区间：**只在 start 与 end 两天各生成一个条目**（pos: start|end，
   *   longSpan: true），中间任何一天都不生成 —— 否则 244 天的“举办期”会把 9 月每一格刷屏。
   * 条目结构：{ev, dayIndex, span, pos, longSpan}
   */
  function buildIndex(events) {
    var map = new Map();
    function push(key, entry) {
      var list = map.get(key);
      if (!list) { list = []; map.set(key, list); }
      list.push(entry);
    }
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      var start = ev._start || parseYMD(ev.start);
      if (!start) continue;
      var span = ev._span || 1;
      var startKey = ymd(start);

      if (span > LONG_SPAN_LIMIT) {
        push(startKey, { ev: ev, dayIndex: 0, span: span, pos: 'start', longSpan: true });
        var endKey = ev.end || ymd(addDays(start, span - 1));
        if (endKey !== startKey) {
          var endDate = parseYMD(endKey);
          push(endKey, {
            ev: ev,
            dayIndex: endDate ? daysBetween(start, endDate) : span - 1,
            span: span, pos: 'end', longSpan: true
          });
        }
        continue;
      }

      for (var d = 0; d < span; d++) {
        var key = ymd(addDays(start, d));
        var pos = span === 1 ? 'single' : (d === 0 ? 'start' : (d === span - 1 ? 'end' : 'mid'));
        push(key, { ev: ev, dayIndex: d, span: span, pos: pos, longSpan: false });
      }
    }
    map.forEach(function (list) { list.sort(compareEntries); });
    return map;
  }

  /** 月视图的 42 个格子（周一起始） */
  function monthCells(cursor) {
    cursor = asDate(cursor);
    var first = startOfMonth(cursor);
    var gridStart = addDays(first, -weekdayIndex(first));
    var todayKey = ymd(todayDate());
    var cells = [];
    for (var i = 0; i < MONTH_CELLS; i++) {
      var dt = addDays(gridStart, i);
      var key = ymd(dt);
      cells.push({
        date: dt,
        key: key,
        inMonth: dt.getMonth() === cursor.getMonth() && dt.getFullYear() === cursor.getFullYear(),
        isToday: key === todayKey,
        weekend: weekdayIndex(dt) >= 5
      });
    }
    return cells;
  }

  /** 今天之后 N 天内的报名截止（返回 {within, next}，next 用于兜底展示） */
  function upcomingDeadlines(events, fromKey, windowDays, limit) {
    var from = parseYMD(fromKey);
    if (!from) return { within: [], next: [] };
    var limitDate = addDays(from, windowDays);
    var within = [], future = [];
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      if (ev.type !== '报名截止') continue;
      var start = ev._start || parseYMD(ev.start);
      if (!start) continue;
      if (start.getTime() < from.getTime()) continue;
      if (start.getTime() <= limitDate.getTime()) within.push(ev);
      future.push(ev);
    }
    var cmp = function (a, b) { return a.start < b.start ? -1 : (a.start > b.start ? 1 : 0); };
    within.sort(cmp);
    future.sort(cmp);
    return { within: within.slice(0, limit || 6), next: future.slice(0, limit || 3) };
  }

  /**
   * 议程列表分组：每个事件只出现一次。
   * - 默认落在起始日；
   * - fromToday 为真时：已结束的事件跳过，正在进行（start < 今天 <= end）的事件
   *   归到“今天”并标记 ongoing，方便一眼看到“正在进行”。
   * 月视图仍然在区间内每一天显示（由 buildIndex 负责），两者各自符合使用场景。
   */
  function buildAgendaGroups(events, todayKey, fromToday) {
    var map = new Map();
    (events || []).forEach(function (ev) {
      if (!ev || !ev.start) return;
      var key = ev.start;
      var ongoing = false;
      if (fromToday) {
        var last = ev.end || ev.start;
        if (last < todayKey) return;                 // 已结束
        if (ev.start < todayKey) { key = todayKey; ongoing = true; }  // 进行中
      }
      var list = map.get(key);
      if (!list) { list = []; map.set(key, list); }
      list.push({ ev: ev, ongoing: ongoing });
    });
    map.forEach(function (list) { list.sort(compareEntries); });
    return map;
  }

  /** 是否存在“尚未结束”的事件（最后一天 >= fromKey）。注意单日事件的 end 为 null。 */
  function hasUpcomingEvents(events, fromKey) {
    if (!Array.isArray(events)) return false;
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      if (!ev) continue;
      var last = ev.end || ev.start;
      if (last && last >= fromKey) return true;
    }
    return false;
  }

  /**
   * 取出索引里所有日期键并升序排序。
   * 用 forEach 收集而不是 Array.from(map.keys())，避免迭代器/兼容性坑，
   * 也方便在 Node 里直接单测。
   */
  function sortedDateKeys(map) {
    var out = [];
    if (!map || typeof map.forEach !== 'function') return out;
    map.forEach(function (value, key) { out.push(key); });
    out.sort();
    return out;
  }

  /** 从 competitions.json 建 no → 赛事 的索引 */
  function buildCompIndex(comps) {
    var map = new Map();
    if (!Array.isArray(comps)) return map;
    for (var i = 0; i < comps.length; i++) {
      var c = comps[i];
      if (c && c.no != null && !map.has(String(c.no))) map.set(String(c.no), c);
    }
    return map;
  }

  var CalCore = {
    CATS: CATS, TYPES: TYPES, TYPE_META: TYPE_META, LINK_KINDS: LINK_KINDS,
    WEEKDAYS: WEEKDAYS, MAX_CHIPS_PER_DAY: MAX_CHIPS_PER_DAY, EMPTY_HINT: EMPTY_HINT,
    LONG_SPAN_LIMIT: LONG_SPAN_LIMIT, CORE_CATS: CORE_CATS,
    AUDIENCES: AUDIENCES, AUDIENCE_UNKNOWN: AUDIENCE_UNKNOWN,
    pad2: pad2, asDate: asDate, parseYMD: parseYMD, ymd: ymd, startOfMonth: startOfMonth,
    addDays: addDays, addMonths: addMonths, weekdayIndex: weekdayIndex,
    daysBetween: daysBetween, todayDate: todayDate, typeMeta: typeMeta,
    fmtDateTime: fmtDateTime, fmtDateCN: fmtDateCN, weekdayCN: weekdayCN, esc: esc,
    normalizeEvent: normalizeEvent, isSignupEvent: isSignupEvent, isLongSpan: isLongSpan,
    filterEvents: filterEvents, compareEntries: compareEntries, buildIndex: buildIndex,
    monthCells: monthCells, upcomingDeadlines: upcomingDeadlines, buildCompIndex: buildCompIndex,
    sortedDateKeys: sortedDateKeys, hasUpcomingEvents: hasUpcomingEvents,
    buildAgendaGroups: buildAgendaGroups,
    splitOrg: splitOrg, eventOrgs: eventOrgs, matchesOrgs: matchesOrgs,
    buildOrgOptions: buildOrgOptions, audienceOf: audienceOf, matchesAudience: matchesAudience,
    OTHER_CAT: OTHER_CAT, catClass: catClass, extraCats: extraCats
  };

  if (typeof window !== 'undefined') window.CalCore = CalCore;
  if (typeof module !== 'undefined' && module.exports) module.exports = CalCore;

  /* 在 Node 中（无 DOM）只暴露纯函数，不启动界面 */
  if (typeof document === 'undefined') return;

  /* ======================================================================
   * ③ 应用状态与渲染层
   * ==================================================================== */

  var state = {
    rawEvents: [],        // 规范化后的全部事件
    filtered: [],         // 当前筛选结果
    byDate: new Map(),    // 日期索引（每次筛选后重建一次）
    compByNo: new Map(),
    meta: null,
    loadFailed: false,
    loadError: '',
    loadDiag: [],         // 数据来源 / 失败原因诊断（空状态里展示，方便定位）
    orgOptions: [],       // 动态生成的校内单位选项 [{name, count}]
    orgQuery: '',         // 单位筛选框里的搜索词（只过滤可见芯片，不动已选集合）
    orgOpen: false,       // 单位芯片组是否展开
    filters: {
      cats: new Set(CATS), types: new Set(TYPES),
      orgs: new Set(),                 // 空集 = 不限制（全部单位）
      audiences: new Set(AUDIENCES),   // 默认全选 = 不限制
      compByNo: new Map(),             // 供面向对象筛选按 no 查档案
      year: 'all', signupOnly: false, keyword: '',
      compNo: ''                       // 深链 ?no=<编号>：只看某个赛事（空串 = 不限制）
    },
    deep: null,                        // 深链参数（用于顶部提示条与「清除」）
    view: 'month',
    cursor: startOfMonth(todayDate()),
    selectedDate: ymd(todayDate()),
    agendaFromToday: true,
    lastDetailId: null
  };

  var el = {};

  function $(id) { return document.getElementById(id); }

  function cacheEls() {
    ['statsBar', 'statGenerated', 'statSources', 'statEvents', 'statOrgs', 'deadlineBar', 'catFilters', 'typeFilters',
      'audienceFilters', 'btnCoreOnly', 'orgFilters', 'orgToggle', 'orgSearch', 'btnAllOrgs', 'btnClearOrgs',
      'orgHint', 'orgSelectedBadge', 'yearSelect', 'signupOnly', 'searchInput', 'resultCount',
      'btnAllCats', 'btnAllTypes', 'btnReset',
      'btnPrev', 'btnToday', 'btnNext', 'periodLabel', 'btnMonthView', 'btnAgendaView', 'monthView',
      'monthGrid', 'legend', 'legendBody', 'agendaView', 'agendaList', 'agendaFromToday', 'dayPanel', 'emptyState',
      'emptyIcon', 'emptyTitle', 'emptyMsg', 'emptyPath', 'emptyDiag', 'emptyRetry',
      'overlay', 'detailDrawer', 'footMeta', 'deepLinkBar'
    ].forEach(function (id) { el[id] = $(id); });
  }

  /* ---------- 顶栏 / 提示区 ---------- */

  function renderStats() {
    var meta = state.meta || {};
    var stats = meta.stats || {};
    var total = stats.sources_total != null ? stats.sources_total : '—';
    var ok = stats.sources_ok != null ? stats.sources_ok : '—';
    var evCount = stats.events != null ? stats.events : state.rawEvents.length;

    el.statGenerated.textContent = fmtDateTime(meta.generated_at || stats.last_run || '');
    el.statSources.textContent = ok + '/' + total;
    el.statEvents.textContent = evCount + ' 个';
    if (el.statOrgs) {
      var picked = state.filters.orgs ? state.filters.orgs.size : 0;
      el.statOrgs.textContent = picked ? (picked + ' / ' + state.orgOptions.length + ' 个') : '全部';
      el.statOrgs.parentNode.classList.toggle('active', picked > 0);
    }

    var srcStat = el.statSources.parentNode;
    var bad = typeof stats.sources_ok === 'number' && typeof stats.sources_total === 'number' &&
      (stats.sources_total === 0 || stats.sources_ok < stats.sources_total);
    srcStat.classList.toggle('bad', bad);

    el.footMeta.textContent = '事件 ' + state.rawEvents.length + ' 条 · 赛事档案 ' + state.compByNo.size + ' 项 · 最近运行 ' +
      fmtDateTime(stats.last_run || meta.generated_at || '');
  }

  function renderDeadlines() {
    var todayKey = ymd(todayDate());
    var res = upcomingDeadlines(state.rawEvents, todayKey, DEADLINE_WINDOW, 6);
    var bar = el.deadlineBar;
    var html = [];

    if (state.loadFailed || state.rawEvents.length === 0) {
      bar.className = 'deadline-bar is-empty';
      bar.innerHTML = '<span class="dl-title">⏰ 报名截止提醒</span>' +
        '<span class="dl-more">' + esc(EMPTY_HINT) + '</span>';
      return;
    }

    if (res.within.length) {
      bar.className = 'deadline-bar';
      html.push('<span class="dl-title">⏰ 未来 ' + DEADLINE_WINDOW + ' 天内的报名截止' +
        '<span class="dl-count">' + res.within.length + '</span></span>');
      res.within.forEach(function (ev) {
        var left = daysBetween(parseYMD(todayKey), ev._start);
        html.push('<button type="button" class="dl-item' + (left <= 3 ? ' urgent' : '') + '" data-event-id="' + esc(ev.id) + '" title="' +
          esc(ev.title || ev.name) + '">' +
          '<span class="dl-date">' + esc(ev.start.slice(5)) + '</span>' +
          '<span class="dl-name">' + esc(ev.name) + '</span>' +
          '<span class="dl-left">' + (left <= 0 ? '今天' : '剩 ' + left + ' 天') + '</span>' +
          '</button>');
      });
      if (res.within.length >= 6) {
        html.push('<span class="dl-more">…更多请见议程列表</span>');
      }
    } else {
      bar.className = 'deadline-bar is-empty';
      html.push('<span class="dl-title">⏰ 未来 ' + DEADLINE_WINDOW + ' 天内暂无报名截止</span>');
      if (res.next.length) {
        html.push('<span class="dl-more">最近的报名截止：</span>');
        res.next.forEach(function (ev) {
          html.push('<button type="button" class="dl-item" data-event-id="' + esc(ev.id) + '">' +
            '<span class="dl-date">' + esc(ev.start.slice(5)) + '</span>' +
            '<span class="dl-name">' + esc(ev.name) + '</span>' +
            '</button>');
        });
      }
    }
    bar.innerHTML = html.join('');
  }

  /* ---------- 筛选栏 ---------- */

  var CAT_LABEL = { '其他': '其他（未归类）' };

  /**
   * 类别筛选芯片：固定 A1~B2，另外若数据里出现了契约外的类别（如“其他”），
   * 动态补一个中性色芯片并默认勾选，保证这类事件不会“凭空消失”。
   */
  function renderCatFilters() {
    var all = CATS.concat(extraCats(state.rawEvents));
    el.catFilters.innerHTML = all.map(function (c) {
      var isStd = CATS.indexOf(c) >= 0;
      return '<label class="pick ' + catClass(c) + '" data-cat="' + esc(c) + '"' +
        (isStd ? '' : ' title="该事件的类别不在 A1~B2 契约内，已归入“其他”"') + '>' +
        '<input type="checkbox" value="' + esc(c) + '" checked>' +
        '<span class="dot"></span><span>' + esc(isStd ? c : (CAT_LABEL[c] || c)) + '</span></label>';
    }).join('');
  }

  function renderTypeFilters() {
    var html = [];
    TYPES.forEach(function (t) {
      var meta = typeMeta(t);
      // type-<key> 类负责注入该类型自己的 --type-color / --type-tint（与月视图 chip 共用同一套色板）
      html.push('<label class="pick type type-' + meta.key + '" data-type="' + esc(t) + '">' +
        '<input type="checkbox" value="' + esc(t) + '" checked>' +
        '<span class="t-icon">' + meta.icon + '</span><span>' + esc(t) + '</span></label>');
    });
    el.typeFilters.innerHTML = html.join('');
  }

  /**
   * 面向对象芯片：固定 本科生 / 研究生 / 全校学生 / 未标注，默认全选（= 不限制）。
   * 取值来自 competitions.json 的 audience（按事件 no 关联），空串与无档案都归“未标注”。
   */
  function renderAudienceFilters() {
    el.audienceFilters.innerHTML = AUDIENCES.map(function (a) {
      return '<label class="pick aud" data-aud="' + esc(a) + '"' +
        (a === AUDIENCE_UNKNOWN ? ' title="赛事档案里未标注面向对象（含没有档案的事件）"' : '') + '>' +
        '<input type="checkbox" value="' + esc(a) + '" checked>' +
        '<span class="dot"></span><span>' + esc(a) + '</span></label>';
    }).join('');
  }

  /** 类别档位的简短释义（只做识别提示，正式定义以学校竞赛管理办法为准） */
  var CAT_DESC = {
    'A1': '教育部 / 共青团中央等牵头的顶级赛事',
    'A2': '学科竞赛排行榜及研究生创新实践系列重大赛事',
    'B1': 'B1 档赛事',
    'B2': 'B2 档赛事',
    '其他': '类别不在 A1~B2 契约内（含缺失），统一按“其他”显示'
  };

  /**
   * 图例：可折叠（<details>），一次讲清两套颜色通道。
   *   通道① 类别 / 政策档位 → chip 背景浅色 + 字母徽章
   *   通道② 事件类型        → chip 左侧 4px 色条 + 图标颜色
   */
  function renderLegend() {
    var cats = CATS.concat(extraCats(state.rawEvents));
    var catRow = cats.map(function (c) {
      return '<span class="lg lg-cat ' + catClass(c) + '">' +
        '<i class="sw ' + catClass(c) + '"></i><b>' + esc(c) + '</b>' +
        '<span class="lg-desc">' + esc(CAT_DESC[c] || c) + '</span></span>';
    }).join('');

    var typeRow = TYPES.map(function (t) {
      var meta = typeMeta(t);
      return '<span class="lg lg-type type-' + meta.key + '">' +
        '<i class="bar"></i><span class="t-icon">' + meta.icon + '</span>' + esc(t) + '</span>';
    }).join('');

    el.legendBody.innerHTML =
      '<div class="lg-row"><span class="lg-row-title">类别（政策档位）</span>' + catRow + '</div>' +
      '<div class="lg-row"><span class="lg-row-title">事件类型</span>' + typeRow + '</div>' +
      '<div class="lg-row"><span class="lg-row-title">怎么看一个 chip</span>' +
        '<span class="lg">背景浅色 = 类别（A1 红 / A2 橙 / B1 蓝 / B2 绿），左侧 4px 色条 + 图标颜色 = 事件类型</span>' +
        '<span class="lg">起 / 止 = 跨天事件首尾日；≤7 天的区间中间显示 (第n天)，>7 天的长区间只在起止两天显示</span>' +
      '</div>' +
      '<div class="legend-note">颜色只用于加速识别：色盲 / 黑白打印时请依赖类别字母徽章（A1/A2/B1/B2）与类型图标。' +
      '档位释义以学校《学生学科和科技竞赛管理办法》为准。</div>';
  }

  function renderYearOptions() {
    var years = {};
    state.rawEvents.forEach(function (ev) { if (ev.year) years[ev.year] = true; });
    var list = Object.keys(years).map(Number).sort(function (a, b) { return b - a; });
    var cur = state.filters.year;
    var html = ['<option value="all">全部年份</option>'];
    list.forEach(function (y) {
      html.push('<option value="' + y + '">' + y + ' 年</option>');
    });
    el.yearSelect.innerHTML = html.join('');
    el.yearSelect.value = (cur !== 'all' && list.indexOf(cur) >= 0) ? String(cur) : 'all';
    state.filters.year = el.yearSelect.value === 'all' ? 'all' : Number(el.yearSelect.value);
  }

  /**
   * 校内单位（学院）芯片组：选项全部由 events.json 的 org 字段动态生成（已按“、”拆分去重），
   * 数量可能 30+，所以默认折叠 + 带搜索；选择状态存在 state.filters.orgs，搜索只影响可见性，
   * 不会把已选中的单位弄丢。
   */
  function renderOrgFilters() {
    var opts = state.orgOptions || [];
    if (!opts.length) {
      el.orgFilters.innerHTML = '<span class="org-empty">该数据集里没有“校内组织单位”字段。</span>';
      return;
    }
    var q = (state.orgQuery || '').trim().toLowerCase();
    var shown = opts.filter(function (o) { return !q || o.name.toLowerCase().indexOf(q) >= 0; });
    if (!shown.length) {
      el.orgFilters.innerHTML = '<span class="org-empty">没有匹配“' + esc(state.orgQuery) + '”的校内单位。</span>';
      return;
    }
    el.orgFilters.innerHTML = shown.map(function (o) {
      var on = state.filters.orgs.has(o.name);
      return '<label class="pick org' + (on ? ' on' : '') + '" data-org="' + esc(o.name) + '" title="' +
        esc(o.name) + '：' + o.count + ' 个事件">' +
        '<input type="checkbox" value="' + esc(o.name) + '"' + (on ? ' checked' : '') + '>' +
        '<span class="dot"></span><span class="org-name">' + esc(o.name) + '</span>' +
        '<span class="org-cnt">' + o.count + '</span></label>';
    }).join('');
  }

  /** 同步单位筛选的可见状态：徽标 / 提示 / 折叠 / 已选芯片高亮（不重建 DOM，避免打断输入） */
  function syncOrgUI() {
    var picked = state.filters.orgs.size;
    var total = (state.orgOptions || []).length;
    var names = [];
    (state.orgOptions || []).forEach(function (o) { if (state.filters.orgs.has(o.name)) names.push(o.name); });

    if (el.orgSelectedBadge) {
      el.orgSelectedBadge.textContent = picked ? ('已选 ' + picked + ' 个') : '全部';
      el.orgSelectedBadge.classList.toggle('on', picked > 0);
    }
    if (el.orgHint) {
      el.orgHint.textContent = picked
        ? ('已选 ' + picked + ' / ' + total + ' 个：' + names.slice(0, 3).join('、') + (names.length > 3 ? ' 等' : ''))
        : '未选择 = 全部单位（多选，命中任一即算命中）';
    }
    if (el.orgToggle) {
      el.orgToggle.setAttribute('aria-expanded', String(!!state.orgOpen));
      el.orgToggle.innerHTML = (state.orgOpen ? '收起学院筛选' : '展开学院筛选') +
        '（' + total + '）<span class="caret">' + (state.orgOpen ? '▴' : '▾') + '</span>';
    }
    if (el.orgFilters) {
      el.orgFilters.hidden = !state.orgOpen;
      Array.prototype.forEach.call(el.orgFilters.querySelectorAll('label[data-org]'), function (lab) {
        var on = state.filters.orgs.has(lab.getAttribute('data-org'));
        lab.classList.toggle('on', on);
        var inp = lab.querySelector('input');
        if (inp) inp.checked = on;
      });
    }
    if (el.statOrgs) {
      el.statOrgs.textContent = picked ? (picked + ' / ' + total + ' 个') : '全部';
      el.statOrgs.parentNode.classList.toggle('active', picked > 0);
    }
  }

  /** 当前是否正好只选了核心两档（A1+A2）——用于点亮“只看核心”标签 */
  function isCoreOnly() {
    var c = state.filters.cats;
    return !!c && c.size === CORE_CATS.length &&
      CORE_CATS.every(function (x) { return c.has(x); });
  }

  function syncCatPill() {
    if (!el.btnCoreOnly) return;
    var on = isCoreOnly();
    el.btnCoreOnly.classList.toggle('is-active', on);
    el.btnCoreOnly.setAttribute('aria-pressed', String(on));
  }

  /** “只看核心（A1+A2）”：开 → 类别只留 A1/A2；关 → 恢复全选类别 */
  function setCoreOnly(on) {
    Array.prototype.forEach.call(el.catFilters.querySelectorAll('input'), function (inp) {
      inp.checked = on ? (CORE_CATS.indexOf(inp.value) >= 0) : true;
    });
    readFilters();
    applyFilters();
  }

  function syncFilterUI() {
    var f = state.filters;
    Array.prototype.forEach.call(el.catFilters.querySelectorAll('input'), function (inp) {
      var on = f.cats.has(inp.value);
      inp.checked = on;
      inp.parentNode.classList.toggle('on', on);
    });
    Array.prototype.forEach.call(el.typeFilters.querySelectorAll('input'), function (inp) {
      var on = f.types.has(inp.value);
      inp.checked = on;
      inp.parentNode.classList.toggle('on', on);
    });
    Array.prototype.forEach.call(el.audienceFilters.querySelectorAll('input'), function (inp) {
      var on = f.audiences.has(inp.value);
      inp.checked = on;
      inp.parentNode.classList.toggle('on', on);
    });
    el.signupOnly.checked = f.signupOnly;
    el.yearSelect.value = f.year === 'all' ? 'all' : String(f.year);
    if (el.searchInput.value !== f.keyword) el.searchInput.value = f.keyword;
    el.agendaFromToday.checked = state.agendaFromToday;
    syncCatPill();
    syncOrgUI();
  }

  function readFilters() {
    var cats = new Set(), types = new Set(), auds = new Set();
    Array.prototype.forEach.call(el.catFilters.querySelectorAll('input:checked'), function (i) { cats.add(i.value); });
    Array.prototype.forEach.call(el.typeFilters.querySelectorAll('input:checked'), function (i) { types.add(i.value); });
    Array.prototype.forEach.call(el.audienceFilters.querySelectorAll('input:checked'), function (i) { auds.add(i.value); });
    state.filters = {
      cats: cats,
      types: types,
      audiences: auds,
      // 单位 / 赛事档案不在 DOM 里逐项读取（单位芯片可能被搜索隐藏、也可能是折叠状态）
      orgs: state.filters.orgs || new Set(),
      compByNo: state.compByNo,
      year: el.yearSelect.value === 'all' ? 'all' : Number(el.yearSelect.value),
      signupOnly: el.signupOnly.checked,
      keyword: el.searchInput.value || '',
      // 深链的「只看某个赛事」不在表单里，单独保留（「清除」按钮负责复位）
      compNo: state.filters.compNo || ''
    };
    syncFilterUI();
  }

  /** 唯一入口：筛选 → 重建索引 → 重绘 */
  function applyFilters() {
    state.filters.compByNo = state.compByNo;
    state.filtered = filterEvents(state.rawEvents, state.filters);
    state.byDate = buildIndex(state.filtered);

    var total = state.rawEvents.length;
    var bits = [];
    if (state.filters.compNo) {
      var c = state.compByNo.get(String(state.filters.compNo));
      bits.push('只看赛事 ' + (c ? c.name : ('#' + state.filters.compNo)));
    }
    if (state.filters.signupOnly) bits.push('仅报名相关');
    if (isCoreOnly()) bits.push('只看核心 A1+A2');
    if (state.filters.orgs && state.filters.orgs.size) bits.push('学院 ' + state.filters.orgs.size + ' 个');
    var audAll = AUDIENCES.every(function (a) { return state.filters.audiences.has(a); });
    if (!audAll) bits.push('面向对象 ' + state.filters.audiences.size + ' 类');

    el.resultCount.innerHTML = '筛选结果 <b>' + state.filtered.length + '</b> / ' + total + ' 个事件' +
      (bits.length ? '（' + bits.join(' · ') + '）' : '');

    renderDeepLink();
    renderMonth();
    renderAgenda();
    renderDayPanel();
  }

  /* ---------- 深链提示条（?no=<赛事编号>） ---------- */

  /** 深链里的赛事编号 → 展示用信息（优先赛事档案，其次事件数据） */
  function deepCompInfo(no) {
    no = String(no);
    var comp = state.compByNo.get(no) || null;
    var name = comp ? comp.name : '';
    var cat = comp ? comp.cat : '';
    if (!name) {
      for (var i = 0; i < state.rawEvents.length; i++) {
        if (String(state.rawEvents[i].no) === no) { name = state.rawEvents[i].name; cat = state.rawEvents[i].cat; break; }
      }
    }
    return { no: no, name: name || ('编号 #' + no), cat: cat, comp: comp };
  }

  /**
   * 顶部醒目提示条：「当前只看：全国大学生数学建模竞赛（A2） · 共 N 个事件 · 清除」
   * 只有深链 ?no= 生效时才显示；编号在数据里找不到时给灰色提示，不静默忽略。
   */
  function renderDeepLink() {
    var bar = el.deepLinkBar;
    if (!bar) return;
    var d = state.deep;
    if (!d || !d.no) { bar.hidden = true; bar.innerHTML = ''; return; }

    var info = deepCompInfo(d.no);
    var isMissing = !state.filters.compNo;
    var extra = [];
    if (state.filters.year !== 'all') extra.push(esc(state.filters.year) + ' 年');
    if (state.filters.types && state.filters.types.size < TYPES.length) {
      var ts = [];
      state.filters.types.forEach(function (t) { ts.push(t); });
      extra.push('类型：' + ts.join('、'));
    }
    if (state.filters.cats && state.filters.cats.size < CATS.length + extraCats(state.rawEvents).length) {
      var cs = [];
      state.filters.cats.forEach(function (c) { cs.push(c); });
      extra.push('类别：' + cs.join('、'));
    }
    if (state.filters.keyword) extra.push('关键词：' + state.filters.keyword);

    bar.className = 'deeplink-bar' + (isMissing ? ' is-missing' : '');
    bar.innerHTML =
      '<span class="dlb-tag">当前只看：</span>' +
      '<span class="dlb-name">' + esc(info.name) + '</span>' +
      (info.cat ? '<span class="dlb-cat ' + catClass(info.cat) + '">' + esc(info.cat) + '</span>' : '') +
      '<span class="dlb-meta">' +
        (isMissing
          ? '数据里没有编号 #' + esc(d.no) + ' 的赛事，未做筛选'
          : '共 <b>' + state.filtered.length + '</b> 个事件' +
            (state.filtered.length ? '' : '（该赛事目前没有事件记录）')) +
        (extra.length ? ' · ' + esc(extra.join(' · ')) : '') +
      '</span>' +
      '<span class="dlb-actions">' +
        '<button type="button" class="dlb-clear" id="btnClearDeepLink" title="清除「只看某个赛事」，回到全部事件">清除 ✕</button>' +
      '</span>';
    bar.hidden = false;
  }

  /** 清除深链带来的收窄（赛事 / 年份 / 类型 / 类别 / 关键词），保留用户手动加的其它筛选 */  function clearDeepLink() {
    var d = state.deep || {};
    state.filters.compNo = '';
    state.deep = null;
    if (d.year) el.yearSelect.value = 'all';
    if (d.type) {
      Array.prototype.forEach.call(el.typeFilters.querySelectorAll('input'), function (i) { i.checked = true; });
    }
    if (d.cat) {
      Array.prototype.forEach.call(el.catFilters.querySelectorAll('input'), function (i) { i.checked = true; });
    }
    if (d.q) el.searchInput.value = '';
    readFilters();          // 重新读表单（compNo 已在上面清空）
    applyFilters();
    syncCleanUrl();
  }

  /** 把 ?no=... 从地址栏摘掉（file:// 下 replaceState 可能抛 SecurityError，忽略即可） */
  function syncCleanUrl() {
    try {
      var url = location.pathname + location.hash;
      history.replaceState(null, '', url);
    } catch (e) { /* 老浏览器 / file:// 限制，忽略 */ }
  }

  /* ---------- 深链参数（?no=12&year=2026&type=报名截止&cat=A2&q=数学） ---------- */

  function readQuery() {
    var q = {};
    try {
      var s = String(location.search || '').replace(/^\?/, '');
      if (s) {
        s.split('&').forEach(function (kv) {
          if (!kv) return;
          var i = kv.indexOf('=');
          var k = i < 0 ? kv : kv.slice(0, i);
          var v = i < 0 ? '' : kv.slice(i + 1);
          q[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
        });
      }
    } catch (e) { /* 非法 query 直接忽略 */ }
    return q;
  }

  function availableYears() {
    var seen = {};
    state.rawEvents.forEach(function (ev) { if (ev.year) seen[ev.year] = true; });
    return Object.keys(seen).map(Number);
  }

  /**
   * 深链只看某个赛事时，把月视图定位到它最近的一个节点所在月份：
   * 优先「今天及以后最早的一个」，全是历史事件就退到最近的一条。
   * 这样点进来立刻能看到东西，而不是停在一个与它无关的月份。
   */
  function focusMonthForComp(no) {
    var today = todayDate();
    var next = null, last = null;
    state.rawEvents.forEach(function (ev) {
      if (String(ev.no) !== String(no)) return;
      var s = ev._start;
      if (!s) return;
      if (s.getTime() >= today.getTime() && (next === null || s.getTime() < next.getTime())) next = s;
      if (last === null || s.getTime() > last.getTime()) last = s;
    });
    var d = next || last;
    if (d) state.cursor = startOfMonth(d);
  }

  /**
   * 应用深链参数（有就用，没有就忽略；非法值静默跳过）。
   *   ?no=12            只看 12 号赛事，并在顶部显示提示条
   *   ?no=12&year=2026  再叠加年份
   *   ?no=12&type=报名截止  再叠加事件类型
   * 额外支持 cat / q 两个同类参数，行为一致。
   */
  function applyDeepLink(q) {
    var d = { no: '', year: null, type: '', cat: '', q: '' };

    if (q.no) {
      var no = String(q.no).trim();
      var known = state.compByNo.has(no);
      if (!known) {
        for (var i = 0; i < state.rawEvents.length; i++) {
          if (String(state.rawEvents[i].no) === no) { known = true; break; }
        }
      }
      d.no = no;
      if (known) {
        state.filters.compNo = no;
        focusMonthForComp(no);
      }
    }
    if (q.year) {
      var y = parseInt(q.year, 10);
      if (isFinite(y) && availableYears().indexOf(y) >= 0) { d.year = y; state.filters.year = y; }
    }
    if (q.type && TYPES.indexOf(q.type) >= 0) {
      d.type = q.type;
      state.filters.types = new Set([q.type]);
    }
    if (q.cat && CATS.concat(extraCats(state.rawEvents)).indexOf(q.cat) >= 0) {
      d.cat = q.cat;
      state.filters.cats = new Set([q.cat]);
    }
    if (q.q) {
      d.q = String(q.q);
      state.filters.keyword = d.q;
    }

    state.deep = d.no ? d : null;
    return d;
  }

  /* ---------- 月视图 ---------- */

  function chipHtml(entry, opts) {
    var ev = entry.ev;
    var meta = typeMeta(ev.type);
    var tag = '';
    if (entry.span > 1) {
      if (entry.pos === 'start') tag = '起';
      else if (entry.pos === 'end') tag = '止';
      else tag = '第' + (entry.dayIndex + 1) + '天';
    }
    var cls = ['chip', catClass(ev.cat), 'type-' + meta.key];
    if (entry.span > 1) {
      cls.push('rng');
      if (entry.longSpan) cls.push('rng-long');   // 长区间：中间不显示，只有起 / 止两个锚点
      cls.push(entry.pos === 'start' ? 'rng-start' : (entry.pos === 'end' ? 'rng-end' : 'rng-mid'));
    }
    if (ev.confidence != null && ev.confidence < 0.7) cls.push('conf-low');
    var todayKey = opts && opts.todayKey;
    if (todayKey && ev.end && ev.end < todayKey) cls.push('done');

    var label = ev.name;
    // 校/省/国赛共用一个图标，用图标内的“校/省/国”单字区分层级
    var iconText = meta.short ? meta.icon + meta.short : meta.icon;
    var spanTitle = !(entry.span > 1) ? ev.start
      : (entry.longSpan
        ? ev.start + ' ~ ' + ev.end + '（长区间 · 共 ' + entry.span + ' 天；月视图只在起止两天显示，中间不逐日重复）'
        : ev.start + ' → ' + ev.end + '（共 ' + entry.span + ' 天，第 ' + (entry.dayIndex + 1) + ' 天）');
    var title = (meta.icon + ' ' + ev.type + '｜' + ev.cat + ' 类｜' + ev.name + '\n' + spanTitle +
      (ev.title ? '\n' + ev.title : '') +
      (ev.confidence != null ? '\n置信度 ' + Math.round(ev.confidence * 100) + '%' : ''));

    // 双通道：背景浅色 = 类别（catClass 注入 --cat-tint），左侧 4px 色条 + 图标色 = 事件类型（type-<key> 注入 --type-color）；
    // 类别字母徽章 + 类型图标是无障碍主通道（不依赖颜色也能区分）。
    return '<button type="button" class="' + cls.join(' ') + '" data-event-id="' + esc(ev.id) + '"' +
      ' data-no="' + esc(ev.no) + '" data-cat="' + esc(ev.cat) + '" data-type="' + esc(ev.type) + '"' +
      ' title="' + esc(title) + '">' +
      '<span class="chip-cat" aria-hidden="true">' + esc(ev.cat) + '</span>' +
      '<span class="chip-icon" aria-hidden="true">' + iconText + '</span>' +
      '<span class="chip-name">' + esc(label) + '</span>' +
      (tag ? '<span class="chip-tag">' + esc(tag) + '</span>' : '') +
      '</button>';
  }

  function renderMonth() {
    var cells = monthCells(state.cursor);
    var todayKey = ymd(todayDate());
    var parts = [];

    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      var entries = state.byDate.get(c.key) || [];
      var cls = ['day'];
      if (!c.inMonth) cls.push('out');
      if (c.weekend) cls.push('wkend');
      if (c.isToday) cls.push('today');
      if (c.key === state.selectedDate) cls.push('selected');

      var shown = entries.slice(0, MAX_CHIPS_PER_DAY);
      var chips = shown.map(function (e) { return chipHtml(e, { todayKey: todayKey }); }).join('');
      var rest = entries.length - shown.length;

      parts.push('<div class="' + cls.join(' ') + '" data-date="' + c.key + '" role="gridcell" aria-label="' +
        esc(fmtDateCN(c.key)) + '，' + entries.length + ' 个事件">' +
        '<div class="day-head"><span class="day-num">' + c.date.getDate() + '</span>' +
        (entries.length ? '<span class="day-count">' + entries.length + ' 项</span>' : '') + '</div>' +
        '<div class="chips">' + chips + '</div>' +
        (rest > 0 ? '<button type="button" class="more-btn" data-more="' + c.key + '">+' + rest + ' 条</button>' : '') +
        '</div>');
    }
    el.monthGrid.innerHTML = parts.join('');

    var y = state.cursor.getFullYear(), m = state.cursor.getMonth() + 1;
    el.periodLabel.textContent = y + ' 年 ' + m + ' 月';
  }

  /* ---------- 议程列表视图 ---------- */

  function eventCardHtml(ev, opts) {
    var meta = typeMeta(ev.type);
    var todayKey = (opts && opts.todayKey) || ymd(todayDate());
    var range = ev.end && ev.end !== ev.start;
    var confBadge = (ev.confidence != null && ev.confidence < 0.7)
      ? '<span class="badge warn">待确认</span>' : '';
    var quote = ev.quote ? '<div class="ev-quote">“' + esc(ev.quote) + '”</div>' : '';
    var done = ev.end && ev.end < todayKey;
    var ongoing = opts && opts.ongoing
      ? '<span class="badge soft">进行中 · 第 ' + (daysBetween(ev._start, parseYMD(todayKey)) + 1) + ' 天</span>' : '';
    // 长区间事件在议程里仍然只出现一次（落在起始日 / 今天），这里给个标记说明它在月视图只显示起止
    var longBadge = (range && isLongSpan(ev))
      ? '<span class="badge soft">长区间 · 月视图只在起止显示</span>' : '';

    return '<button type="button" class="ev-card ' + catClass(ev.cat) + ' type-' + meta.key + (done ? ' done' : '') + '"' +
      ' data-event-id="' + esc(ev.id) + '" data-no="' + esc(ev.no) + '" data-cat="' + esc(ev.cat) + '" data-type="' + esc(ev.type) + '">' +
      '<span class="ev-icon">' + meta.icon + '</span>' +
      '<span class="ev-main">' +
        '<span class="ev-top">' +
          '<span class="ev-name">' + esc(ev.name) + '</span>' +
          '<span class="badge cat ' + catClass(ev.cat) + '">' + esc(ev.cat) + '</span>' +
          '<span class="badge type">' + meta.icon + ' ' + esc(ev.type) + '</span>' +
          confBadge + ongoing + longBadge +
        '</span>' +
        (ev.title && ev.title !== ev.name ? '<div class="ev-title">' + esc(ev.title) + '</div>' : '') +
        '<div class="ev-meta">' +
          '<span>📅 ' + esc(range ? ev.start + ' ~ ' + ev.end + '（共 ' + ev._span + ' 天）' : ev.start) + '</span>' +
          (ev.org ? '<span>🏛 ' + esc(ev.org) + '</span>' : '') +
          (ev.no ? '<span>#' + esc(ev.no) + '</span>' : '') +
        '</div>' +
        quote +
      '</span>' +
      '</button>';
  }

  function renderAgenda() {
    var todayKey = ymd(todayDate());
    var groups = buildAgendaGroups(state.filtered, todayKey, state.agendaFromToday);
    var keys = sortedDateKeys(groups);
    var html = [];

    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var entries = groups.get(key) || [];
      if (!entries.length) continue;

      var isToday = key === todayKey;
      var soon = !isToday && daysBetween(parseYMD(todayKey), parseYMD(key)) <= 7;
      var cards = entries.map(function (e) { return eventCardHtml(e.ev, { todayKey: todayKey, ongoing: e.ongoing }); }).join('');

      html.push('<div class="agenda-group" data-agenda-date="' + key + '">' +
        '<div class="agenda-date' + (isToday ? ' is-today' : '') + '">' +
          '<span class="d">' + esc(fmtDateCN(key)) + '</span>' +
          '<span class="w">' + esc(weekdayCN(key)) + '</span>' +
          (isToday ? '<span class="pill">今天</span>' : (soon ? '<span class="soon">即将</span>' : '')) +
          '<span class="cnt">' + entries.length + ' 个事件</span>' +
        '</div>' +
        '<div class="agenda-items">' + cards + '</div>' +
        '</div>');
    }

    if (!html.length) {
      el.agendaList.innerHTML = '<div class="day-none">' +
        (state.rawEvents.length === 0 ? esc(EMPTY_HINT)
          : (state.agendaFromToday ? '没有尚未结束的事件（可取消“只看今天及以后”，或调整筛选条件）' : '当前筛选条件下没有事件')) +
        '</div>';
      return;
    }
    el.agendaList.innerHTML = html.join('');
  }

  /* ---------- 当日事件面板 ---------- */

  function renderDayPanel() {
    if (state.view !== 'month') { el.dayPanel.hidden = true; return; }
    var key = state.selectedDate;
    if (!key) { el.dayPanel.hidden = true; return; }

    var entries = state.byDate.get(key) || [];
    var todayKey = ymd(todayDate());
    var head = '<div class="day-panel-head">' +
      '<h2>' + esc(fmtDateCN(key)) + '　' + esc(weekdayCN(key)) + '</h2>' +
      (key === todayKey ? '<span class="badge soft">今天</span>' : '') +
      '<span class="cnt">共 ' + entries.length + ' 个事件（不受每格 3 条限制）</span>' +
      '<span class="spacer"></span>' +
      '<button type="button" class="btn ghost" id="btnCloseDay">收起</button>' +
      '</div>';

    var body = entries.length
      ? '<div class="day-panel-body">' + entries.map(function (e) {
          return eventCardHtml(e.ev, { todayKey: todayKey });
        }).join('') + '</div>'
      : '<div class="day-none">这一天没有符合当前筛选条件的事件。</div>';

    el.dayPanel.innerHTML = head + body;
    el.dayPanel.hidden = false;
  }

  function selectDate(key, opts) {
    state.selectedDate = key;
    // 若点到其他月份的日期，跟随切换月份
    var d = parseYMD(key);
    if (d && (d.getFullYear() !== state.cursor.getFullYear() || d.getMonth() !== state.cursor.getMonth())) {
      state.cursor = startOfMonth(d);
    }
    if (state.view !== 'month') { setView('month'); }
    renderMonth();
    renderDayPanel();
    if (opts && opts.scroll) {
      try { el.dayPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) { /* 老浏览器忽略 */ }
    }
  }

  /* ---------- 详情抽屉 ---------- */

  function linkBlocksHtml(comp) {
    if (!comp) return '<p class="empty-hint">未在 competitions.json 中找到该赛事（编号 #' + esc(state.lastDetailNo || '') + '）的链接信息。</p>';
    var out = [];
    var links = comp.links || {};
    LINK_KINDS.forEach(function (k) {
      var arr = Array.isArray(links[k.key]) ? links[k.key] : [];
      if (!arr.length) return;
      out.push('<div class="link-block"><div class="lb-title">' + k.label + '（' + arr.length + '）</div><ul class="link-list">' +
        arr.map(function (l) {
          var url = l && l.url ? String(l.url) : '';
          var nm = l && l.name ? String(l.name) : url;
          if (!url) return '<li><span class="lk-kind">' + k.label + '</span><span>' + esc(nm) + '</span></li>';
          return '<li><span class="lk-kind">' + k.label + '</span>' +
            '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(nm) + '</a></li>';
        }).join('') + '</ul></div>');
    });
    if (!out.length) return '<p class="empty-hint">该赛事暂无登记链接。</p>';
    if (comp.note) out.push('<div class="note">备注：' + esc(comp.note) + '</div>');
    return out.join('');
  }

  function openEventDetail(id) {
    var ev = null;
    for (var i = 0; i < state.filtered.length; i++) {
      if (state.filtered[i].id === id) { ev = state.filtered[i]; break; }
    }
    if (!ev) {
      for (var j = 0; j < state.rawEvents.length; j++) {
        if (state.rawEvents[j].id === id) { ev = state.rawEvents[j]; break; }
      }
    }
    if (!ev) return;

    state.lastDetailId = id;
    state.lastDetailNo = ev.no;

    var meta = typeMeta(ev.type);
    var range = ev.end && ev.end !== ev.start;
    var longSpan = range && isLongSpan(ev);
    var dateText = range
      ? ev.start + '（' + weekdayCN(ev.start) + '） ~ ' + ev.end + '（' + weekdayCN(ev.end) + '） · 共 ' + ev._span + ' 天' +
        (longSpan ? '　长区间：月视图只在起止两天显示' : '')
      : ev.start + '（' + weekdayCN(ev.start) + '）';
    var confText = ev.confidence == null ? '未知'
      : Math.round(ev.confidence * 100) + '%' + (ev.confidence < 0.7 ? ' <span class="badge warn">待确认</span>' : '');

    var comp = state.compByNo.get(String(ev.no)) || null;
    // 政策字段来自 competitions.json（events.json 里没有），没有值一律显示 “—”
    var audText = comp ? audienceOf(comp) : '—';
    var rankText = (comp && comp.rank_list) ? String(comp.rank_list) : '—';
    var hostText = (comp && comp.host) ? String(comp.host) : '—';
    if (rankText === '是') rankText = '是 <span class="badge soft">中国高等教育学会排行榜</span>';

    var html = '' +
      '<div class="drawer-head type-' + meta.key + '">' +
        '<div>' +
          '<div class="d-badges">' +
            '<span class="badge cat ' + catClass(ev.cat) + '">' + esc(ev.cat) + ' 类</span>' +
            '<span class="badge type">' + meta.icon + ' ' + esc(ev.type) + '</span>' +
            (ev.confidence != null && ev.confidence < 0.7 ? '<span class="badge warn">待确认</span>' : '') +
            (ev.year ? '<span class="badge soft">' + esc(ev.year) + ' 年</span>' : '') +
            (longSpan ? '<span class="badge soft">长区间 ' + ev._span + ' 天</span>' : '') +
            (comp ? '<span class="badge soft">面向 ' + esc(audienceOf(comp)) + '</span>' : '') +
          '</div>' +
          '<h2 id="drawerTitle">' + esc(ev.name) + '</h2>' +
        '</div>' +
        '<button type="button" class="drawer-close" id="btnCloseDrawer" aria-label="关闭">✕</button>' +
      '</div>' +
      '<div class="drawer-body">' +
        '<dl class="d-grid">' +
          '<dt>赛事编号</dt><dd>#' + esc(ev.no || '—') + (ev.cat ? '　（' + esc(ev.cat) + ' 类）' : '') + '</dd>' +
          '<dt>事件类型</dt><dd>' + meta.icon + ' ' + esc(ev.type) + '</dd>' +
          '<dt>日期</dt><dd class="mono">' + esc(dateText) + '</dd>' +
          '<dt>校内单位</dt><dd>' + esc(ev.org || '—') + '</dd>' +
          '<dt>面向对象</dt><dd>' + esc(audText) + '</dd>' +
          '<dt>列入排行榜</dt><dd>' + rankText + '</dd>' +
          '<dt>主办单位</dt><dd>' + esc(hostText) + '</dd>' +
          '<dt>置信度</dt><dd>' + confText + '</dd>' +
          (ev.crawled_at ? '<dt>抓取时间</dt><dd class="mono">' + esc(fmtDateTime(ev.crawled_at)) + '</dd>' : '') +
        '</dl>' +
        (ev.title ? '<div class="d-sec"><h3>事件标题</h3><p>' + esc(ev.title) + '</p></div>' : '') +
        '<div class="d-sec"><h3>原文引用</h3>' +
          (ev.quote ? '<blockquote>' + esc(ev.quote) + '</blockquote>'
                    : '<blockquote class="empty">该事件没有可用的原文引用。</blockquote>') +
        '</div>' +
        '<div class="d-sec"><h3>来源</h3>' +
          '<div class="ev-meta" style="margin-bottom:8px">' +
            '<span>' + esc(ev.source_name || '未知来源') + '</span>' +
            (ev.source_kind ? '<span>类型：' + esc(ev.source_kind) + '</span>' : '') +
          '</div>' +
          '<div class="d-actions">' +
            (ev.source_url
              ? '<a class="btn primary" href="' + esc(ev.source_url) + '" target="_blank" rel="noopener noreferrer">🔗 查看来源</a>'
              : '<button type="button" class="btn" disabled>无来源链接</button>') +
            (ev.source_url ? '<span class="mono" style="font-size:11px;color:#8b94a3;align-self:center;word-break:break-all">' + esc(ev.source_url) + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="d-sec"><h3>该赛事的其他链接</h3>' + linkBlocksHtml(comp) + '</div>' +
      '</div>';

    el.detailDrawer.innerHTML = html;
    el.detailDrawer.hidden = false;
    el.overlay.hidden = false;
    document.body.style.overflow = 'hidden';

    var closeBtn = $('btnCloseDrawer');
    if (closeBtn) closeBtn.focus();
  }

  function closeEventDetail() {
    el.detailDrawer.hidden = true;
    el.overlay.hidden = true;
    el.detailDrawer.innerHTML = '';
    document.body.style.overflow = '';
  }

  /* ---------- 视图切换 / 空状态 ---------- */

  function setView(view) {
    state.view = view;
    var isMonth = view === 'month';
    el.monthView.hidden = !isMonth;
    el.dayPanel.hidden = !isMonth;
    el.agendaView.hidden = isMonth;
    el.btnMonthView.classList.toggle('is-active', isMonth);
    el.btnAgendaView.classList.toggle('is-active', !isMonth);
    el.btnMonthView.setAttribute('aria-selected', String(isMonth));
    el.btnAgendaView.setAttribute('aria-selected', String(!isMonth));
    renderMonth();
    renderAgenda();
    if (isMonth) renderDayPanel();
  }

  function showEmpty(title, msg, icon, path, diag) {
    el.emptyIcon.textContent = icon || '📭';
    el.emptyTitle.textContent = title;
    el.emptyMsg.innerHTML = msg;
    el.emptyPath.textContent = path || '';
    if (el.emptyDiag) {
      var lines = diag || state.loadDiag || [];
      el.emptyDiag.innerHTML = lines.length
        ? ('<span class="diag-title">真实失败原因</span>' + lines.map(function (d) {
            return '<div class="diag-line">' + esc(d) + '</div>';
          }).join(''))
        : '';
      el.emptyDiag.hidden = !el.emptyDiag.innerHTML;
    }
    el.emptyState.hidden = false;
    document.querySelector('.main').hidden = true;
  }

  /* ======================================================================
   * ④ 数据加载 / 事件绑定 / 初始化
   * ==================================================================== */

  function fetchJSON(url) {
    return fetch(url, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error(url + ' HTTP ' + res.status);
      return res.json();
    });
  }

  /** 内嵌通道：data/events.js 里的 window.__EVENTS__（与 events.json 同构） */
  function embeddedEvents() {
    var doc = (typeof window !== 'undefined') ? window.__EVENTS__ : null;
    return (doc && Array.isArray(doc.events) && doc.events.length) ? doc : null;
  }

  /** 内嵌通道：data/competitions.js 里的 window.__COMPETITIONS__（与 competitions.json 同构的数组） */
  function embeddedComps() {
    var doc = (typeof window !== 'undefined') ? window.__COMPETITIONS__ : null;
    if (Array.isArray(doc)) return doc.length ? doc : null;
    if (doc && Array.isArray(doc.competitions) && doc.competitions.length) return doc.competitions;
    return null;
  }

  /**
   * 双通道加载：
   *   ① 优先用 index.html 里 <script src="../../data/events.js"> 注入的 window.__EVENTS__
   *      —— file:// 直接双击打开时也能读到数据（fetch 本地文件会被 CORS 拦掉）；
   *   ② 内嵌不可用时回退到 fetch('../../data/events.json')（http 服务方式）。
   * competitions 同理。全过程记录诊断信息，空状态里原样展示，方便定位。
   */
  function loadData() {
    var diag = [];

    var evDoc = embeddedEvents();
    if (evDoc) diag.push('✓ 数据来源：内嵌 data/events.js（window.__EVENTS__，' + evDoc.events.length + ' 条事件）');
    else diag.push('✗ 内嵌 data/events.js 不可用：window.__EVENTS__ ' +
      (typeof window !== 'undefined' && window.__EVENTS_LOAD_ERROR__ ? '（' + window.__EVENTS_LOAD_ERROR__ + '）'
        : '不存在或 events 为空数组') + '，已回退到 fetch');

    var compsList = embeddedComps();
    if (compsList) diag.push('✓ 数据来源：内嵌 data/competitions.js（window.__COMPETITIONS__，' + compsList.length + ' 项赛事）');
    else diag.push('✗ 内嵌 data/competitions.js 不可用：window.__COMPETITIONS__ ' +
      (typeof window !== 'undefined' && window.__COMPETITIONS_LOAD_ERROR__ ? '（' + window.__COMPETITIONS_LOAD_ERROR__ + '）'
        : '不存在或为空数组') + '，已回退到 fetch');

    var evPromise = evDoc ? Promise.resolve(evDoc)
      : fetchJSON('../../data/events.json').then(function (d) {
          diag.push('✓ fetch ../../data/events.json 成功');
          return d;
        }).catch(function (e) {
          diag.push('✗ fetch ../../data/events.json 失败：' + (e && e.message ? e.message : String(e)));
          return { __error: 'events: ' + (e && e.message ? e.message : String(e)) };
        });

    var compPromise = compsList ? Promise.resolve(compsList)
      : fetchJSON('../../data/competitions.json').then(function (d) {
          diag.push('✓ fetch ../../data/competitions.json 成功');
          return d;
        }).catch(function (e) {
          diag.push('✗ fetch ../../data/competitions.json 失败：' + (e && e.message ? e.message : String(e)));
          return { __error: 'competitions: ' + (e && e.message ? e.message : String(e)) };
        });

    return Promise.all([evPromise, compPromise]).then(function (results) {
      var eventsDoc = results[0], compsDoc = results[1];
      var errors = [];

      if (eventsDoc && eventsDoc.__error) {
        errors.push(eventsDoc.__error);
        state.loadFailed = true;
      } else if (!eventsDoc || !Array.isArray(eventsDoc.events)) {
        errors.push('events 数据结构异常（缺少 events 数组）');
        state.loadFailed = true;
      }

      if (compsDoc && compsDoc.__error) {
        errors.push(compsDoc.__error);           // 赛事档案缺失不影响主流程
      }

      state.loadDiag = diag;
      state.meta = (eventsDoc && !eventsDoc.__error) ? eventsDoc : null;
      state.rawEvents = (eventsDoc && Array.isArray(eventsDoc.events))
        ? eventsDoc.events.map(normalizeEvent).filter(Boolean) : [];
      state.compByNo = buildCompIndex(compsDoc && !compsDoc.__error ? compsDoc : []);
      state.loadError = errors.join('；');

      // 议程默认只看今天及以后；若数据全是过去的事件（爬虫数据过期），
      // 则默认展示全部，避免议程页看起来是空的。
      var todayKey = ymd(todayDate());
      if (!hasUpcomingEvents(state.rawEvents, todayKey)) state.agendaFromToday = false;

      // 类别筛选：含契约外的类别（如“其他”），默认全部勾选
      state.filters.cats = new Set(CATS.concat(extraCats(state.rawEvents)));
      state.filters.audiences = new Set(AUDIENCES);
      state.filters.compByNo = state.compByNo;
      state.filters.orgs = new Set();
      renderCatFilters();
      state.orgOptions = buildOrgOptions(state.rawEvents);

      if (!state.rawEvents.length) {
        showEmpty('暂无数据', emptyHelpHtml(), '📭', '数据文件：data/events.json');
      }
      return errors;
    });
  }

  /**
   * 真没数据时的可操作提示：区分 file:// 与 http。
   * 真实失败原因由 showEmpty 填进 #emptyDiag（只显示一处，避免重复）。
   */
  function emptyHelpHtml() {
    var out = [];
    if (location.protocol === 'file:') {
      out.push('检测到你是<b>直接双击打开文件</b>（<code>file://</code>）的方式：浏览器会以 CORS 策略禁止 fetch 读取本地 ' +
        '<code>data/*.json</code>，所以这种方式只能靠内嵌数据。');
      out.push('① 请确认 <code>data/events.js</code>、<code>data/competitions.js</code> 已生成（抓取管线产出）；');
      out.push('② 或改用服务方式打开：<code>cd ~/wust-competition-calendar &amp;&amp; python3 serve.py</code>，' +
        '再访问 <code>http://127.0.0.1:8787/web/index.html</code>。');
    } else {
      out.push('服务方式下没读到数据：请先运行 <code>crawler/pipeline.py</code> 生成 <code>data/events.json</code>，' +
        '或确认抓取管线已产出 <code>data/events.js</code>。');
    }
    out.push('下面的「真实失败原因」列出了每个通道的具体错误，可据此定位。');
    return out.join('<br>');
  }

  function bindEvents() {
    // 筛选：类别 / 类型 / 面向对象 / 年份 / 开关 / 搜索
    el.catFilters.addEventListener('change', function () { readFilters(); applyFilters(); });
    el.typeFilters.addEventListener('change', function () { readFilters(); applyFilters(); });
    el.audienceFilters.addEventListener('change', function () { readFilters(); applyFilters(); });
    el.yearSelect.addEventListener('change', function () { readFilters(); applyFilters(); });
    el.signupOnly.addEventListener('change', function () { readFilters(); applyFilters(); });

    // “只看核心（A1+A2）”快捷标签：开 → 只选 A1/A2；再点 → 恢复全选类别
    el.btnCoreOnly.addEventListener('click', function () {
      setCoreOnly(!isCoreOnly());
    });

    // 校内单位：选择状态存在 state（不读 DOM，避免被搜索过滤掉后丢选择）
    el.orgFilters.addEventListener('change', function (e) {
      var inp = e.target;
      if (!inp || inp.type !== 'checkbox') return;
      if (inp.checked) state.filters.orgs.add(inp.value);
      else state.filters.orgs.delete(inp.value);
      syncOrgUI();
      applyFilters();
    });
    el.orgToggle.addEventListener('click', function () {
      state.orgOpen = !state.orgOpen;
      syncOrgUI();
    });
    el.orgSearch.addEventListener('input', function () {
      state.orgQuery = el.orgSearch.value || '';
      if (!state.orgOpen) state.orgOpen = true;   // 一搜索就自动展开
      renderOrgFilters();
      syncOrgUI();
    });
    el.btnAllOrgs.addEventListener('click', function () {
      state.filters.orgs = new Set();
      (state.orgOptions || []).forEach(function (o) { state.filters.orgs.add(o.name); });
      renderOrgFilters(); syncOrgUI(); applyFilters();
    });
    el.btnClearOrgs.addEventListener('click', function () {
      state.filters.orgs = new Set();            // 空集 = 不限制（全部单位）
      renderOrgFilters(); syncOrgUI(); applyFilters();
    });

    if (el.emptyRetry) {
      el.emptyRetry.addEventListener('click', function () { location.reload(); });
    }

    var timer = null;
    el.searchInput.addEventListener('input', function () {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { readFilters(); applyFilters(); }, 120);
    });

    el.btnAllCats.addEventListener('click', function () {
      var anyOff = Array.prototype.some.call(el.catFilters.querySelectorAll('input'), function (i) { return !i.checked; });
      Array.prototype.forEach.call(el.catFilters.querySelectorAll('input'), function (i) { i.checked = anyOff; });
      readFilters(); applyFilters();
    });
    el.btnAllTypes.addEventListener('click', function () {
      var anyOff = Array.prototype.some.call(el.typeFilters.querySelectorAll('input'), function (i) { return !i.checked; });
      Array.prototype.forEach.call(el.typeFilters.querySelectorAll('input'), function (i) { i.checked = anyOff; });
      readFilters(); applyFilters();
    });
    el.btnReset.addEventListener('click', function () {
      Array.prototype.forEach.call(el.catFilters.querySelectorAll('input'), function (i) { i.checked = true; });
      Array.prototype.forEach.call(el.typeFilters.querySelectorAll('input'), function (i) { i.checked = true; });
      Array.prototype.forEach.call(el.audienceFilters.querySelectorAll('input'), function (i) { i.checked = true; });
      el.yearSelect.value = 'all';
      el.signupOnly.checked = false;
      el.searchInput.value = '';
      state.filters.orgs = new Set();
      state.filters.compNo = '';       // 深链的「只看某个赛事」也一并清掉
      state.deep = null;
      state.orgQuery = '';
      el.orgSearch.value = '';
      renderOrgFilters();
      readFilters(); applyFilters();
      syncCleanUrl();
    });

    // 月份导航
    el.btnPrev.addEventListener('click', function () { state.cursor = addMonths(state.cursor, -1); renderMonth(); });
    el.btnNext.addEventListener('click', function () { state.cursor = addMonths(state.cursor, 1); renderMonth(); });
    el.btnToday.addEventListener('click', function () {
      state.cursor = startOfMonth(todayDate());
      state.selectedDate = ymd(todayDate());
      setView('month');
      renderMonth();
      renderDayPanel();
    });

    // 视图切换
    el.btnMonthView.addEventListener('click', function () { setView('month'); });
    el.btnAgendaView.addEventListener('click', function () { setView('agenda'); });
    el.agendaFromToday.addEventListener('change', function () {
      state.agendaFromToday = el.agendaFromToday.checked;
      renderAgenda();
    });

    // 全局委托：事件 chip / 日期格 / +N 条 / 关闭按钮
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;

      if (t.closest('#btnClearDeepLink')) { e.preventDefault(); clearDeepLink(); return; }

      var evEl = t.closest('[data-event-id]');
      if (evEl) {
        e.preventDefault();
        var id = evEl.getAttribute('data-event-id');
        var dayEl = evEl.closest('[data-date]');
        if (dayEl) {
          var k = dayEl.getAttribute('data-date');
          if (k !== state.selectedDate) { state.selectedDate = k; renderMonth(); renderDayPanel(); }
        }
        openEventDetail(id);
        return;
      }

      if (t.closest('#btnCloseDrawer')) { closeEventDetail(); return; }
      if (t.closest('#btnCloseDay')) { el.dayPanel.hidden = true; state.selectedDate = null; renderMonth(); return; }
      if (t.id === 'overlay') { closeEventDetail(); return; }

      var moreEl = t.closest('[data-more]');
      if (moreEl) { e.preventDefault(); selectDate(moreEl.getAttribute('data-more'), { scroll: true }); return; }

      var day = t.closest('.day[data-date]');
      if (day) { selectDate(day.getAttribute('data-date'), { scroll: true }); return; }
    });

    // 键盘：ESC 关闭抽屉 / ← → 切换月份
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (!el.detailDrawer.hidden) { closeEventDetail(); return; }
        if (!el.dayPanel.hidden) { el.dayPanel.hidden = true; state.selectedDate = null; renderMonth(); }
        return;
      }
      if (el.detailDrawer && !el.detailDrawer.hidden) return;
      var tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') { state.cursor = addMonths(state.cursor, -1); renderMonth(); }
      else if (e.key === 'ArrowRight') { state.cursor = addMonths(state.cursor, 1); renderMonth(); }
      else if (e.key === 't' || e.key === 'T') { el.btnToday.click(); }
    });
  }

  function init() {
    cacheEls();
    renderTypeFilters();
    renderAudienceFilters();
    renderOrgFilters();
    renderLegend();
    bindEvents();

    loadData().then(function () {
      renderStats();
      renderYearOptions();
      renderOrgFilters();
      renderLegend();                 // 数据到位后重绘图例（含契约外的类别，如“其他”）
      applyDeepLink(readQuery());     // 深链 ?no=&year=&type=：在同步筛选 UI 之前生效
      syncFilterUI();
      renderDeadlines();
      applyFilters();
      setView('month');
    }).catch(function (err) {
      // 理论上不会走到这里（两条通道都已兜底），保底再兜一层
      state.loadFailed = true;
      showEmpty('数据加载失败', emptyHelpHtml(), '⚠️',
        '错误信息：' + (err && err.message ? err.message : String(err)));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
