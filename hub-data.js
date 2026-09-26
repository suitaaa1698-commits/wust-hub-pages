/* ==========================================================================
 * 武科大资源汇总站 — 共用数据层（赛事总览 / 历年情况 共用）
 *
 * 零依赖 / 零构建 / 零 CDN；纯 vanilla ES5。
 *
 * 加载约定（与日历页一致，file:// 直接双击也必须能用）：
 *   ① 优先读页面里 <script src="../../data/xxx.js"> 注入的内嵌全局变量
 *      window.__EVENTS__ / window.__COMPETITIONS__ / window.__COVERAGE__ / window.__SOURCES__
 *      —— file:// 下 fetch 本地 json 会被 CORS 拦掉，只有内嵌通道可用；
 *   ② 内嵌不可用时，**仅在 http(s) 下**回退 fetch 同名 .json。
 *      刻意不在 file:// 下发起 fetch：那会往控制台抛 CORS 错误，属于“报错”。
 *
 * 数据契约：
 *   events.json        { stats:{...}, events:[ {id,no,name,cat,org,type,title,start,end,year,...} ] }
 *   competitions.json  [ {no,cat,org,name,note,audience,rank_list,host,links:{...}} ]
 *                      cat ∈ A1 / A2 / B1 / B2 / C（官方名录 1–224，C 类为 185–224）
 *   coverage.json      { generated_at, items:{ "<no>": {sources,events,first_event,last_event,
 *                                                       next_event,status,note} } }   ← 可选
 *   sources.json       [ {no,cat,name,kind,label,url} ]                                ← 可选
 *
 * coverage.json 缺失时的降级：用 sources.json（来源条数）+ events.json（事件）**本地推导**出
 * 完全相同的字段（sources / events / first_event / last_event / next_event / status）。
 * 若 coverage.json 存在，则由抓取管线预先算好，会以 `window.__COVERAGE__`（data/coverage.js）
 * 的内嵌形式优先采用；覆盖不到的字段再用本地推导补齐。
 * ========================================================================== */
(function (global) {
  'use strict';

  /* ---------------- 常量 ---------------- */

  var CATS = ['A1', 'A2', 'B1', 'B2', 'C'];
  /** 类别 → 与日历页完全一致的档位色（C 为中性灰蓝，与 A1 红 / A2 橙 / B1 蓝 / B2 绿可区分） */
  var CAT_COLOR = { 'A1': '#d93025', 'A2': '#e8710a', 'B1': '#1a73e8', 'B2': '#188038', 'C': '#5f7a95' };
  var CAT_OTHER_COLOR = '#9aa3b2';
  var CAT_LABEL = {
    'A1': 'A1 档 · 教育部 / 共青团中央等牵头',
    'A2': 'A2 档 · 排行榜及研究生创新实践系列重大赛事',
    'B1': 'B1 档',
    'B2': 'B2 档',
    'C': 'C 档 · 省级 / 其他认定赛事'
  };

  var TYPES = ['报名开始', '报名截止', '作品提交', '校赛', '省赛', '国赛', '结果公布', '培训会议', '其他'];
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

  var AUDIENCES = ['本科生', '研究生', '全校学生'];
  var AUDIENCE_UNKNOWN = '未标注';

  var STATUS_LABEL = {
    'ok': '有时间信息',
    'no_info': '暂无报名信息',
    'no_source': '暂无来源'
  };

  /* ---------------- 基础工具 ---------------- */

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** URL 安全校验：只放行 http(s)，拒绝带用户名 / 密码的形式（与 web/resource-core.js 的 safeUrl 同口径） */
  function safeUrl(value) {
    if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) return '';
    try {
      var url = new URL(value);
      return (url.username || url.password) ? '' : url.href;
    } catch (e) { return ''; }
  }

  /** 'YYYY-MM-DD' → 本地时区当天 00:00 的 Date；非法返回 null（不依赖 Date 解析时区） */
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

  function ymd(dt) {
    return dt.getFullYear() + '-' + pad2(dt.getMonth() + 1) + '-' + pad2(dt.getDate());
  }

  function todayKey() { var n = new Date(); return ymd(new Date(n.getFullYear(), n.getMonth(), n.getDate())); }

  function fmtDateCN(key) {
    var d = parseYMD(key);
    if (!d) return key || '—';
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  function fmtMD(key) {
    var d = parseYMD(key);
    return d ? (d.getMonth() + 1) + '月' + d.getDate() + '日' : (key || '—');
  }

  /** ISO 时间串 → 'YYYY-MM-DD HH:MM'（同样不依赖 Date 的时区解析） */
  function fmtDT(s) {
    if (typeof s !== 'string' || !s) return '—';
    var m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(s);
    if (m) return m[1] + '-' + m[2] + '-' + m[3] + ' ' + m[4] + ':' + m[5];
    return s;
  }

  function num(v, dflt) {
    return (typeof v === 'number' && isFinite(v)) ? v : (dflt === undefined ? 0 : dflt);
  }

  /** no 统一成字符串（数据里都是字符串，但防御一手） */
  function normalizeNo(v) { return (v === null || v === undefined) ? '' : String(v).trim(); }

  /** 序号排序：能转数字就按数字，否则按字符串（1 < 2 < 10 < 100） */
  function cmpNo(a, b) {
    var na = parseInt(normalizeNo(a), 10), nb = parseInt(normalizeNo(b), 10);
    if (isFinite(na) && isFinite(nb) && na !== nb) return na - nb;
    var sa = normalizeNo(a), sb = normalizeNo(b);
    return sa < sb ? -1 : (sa > sb ? 1 : 0);
  }

  function cmpDate(a, b) {
    var sa = a || '', sb = b || '';
    return sa < sb ? -1 : (sa > sb ? 1 : 0);
  }

  function catColor(cat) { return CAT_COLOR[cat] || CAT_OTHER_COLOR; }
  function catClass(cat) { return CATS.indexOf(cat) >= 0 ? 'cat-' + cat : 'cat-other'; }
  function typeMeta(t) { return TYPE_META[t] || { icon: '📌', key: 'other', prio: 9, signup: false }; }
  function statusLabel(s) { return STATUS_LABEL[s] || s || ''; }

  /**
   * 拆分「校内组织单位」：与日历页 app.js 的 splitOrg 完全一致，
   * 保证总览页按学院筛选的口径和日历页一致。
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

  function competitionOrgs(comp) { return splitOrg(comp && comp.org); }

  function audienceOf(comp) {
    var a = comp && comp.audience !== null && comp.audience !== undefined ? String(comp.audience).trim() : '';
    return a || AUDIENCE_UNKNOWN;
  }

  /* ---------------- 事件侧统计（按赛事 no 聚合） ---------------- */

  /**
   * 每个赛事的事件统计：
   *   { count, first, last, next, years:[...], byYear:Map, months:Set, types:Count }
   * first / last 用「结束日 ?? 开始日」比较（跨天事件按最后一天算）；
   * next = 今天及以后最早的一个开始日（没有则 null）。
   */
  function eventStatsByNo(events) {
    var map = new Map();
    var tk = todayKey();
    (events || []).forEach(function (ev) {
      if (!ev) return;
      var no = normalizeNo(ev.no);
      if (!no) return;
      var start = typeof ev.start === 'string' ? ev.start.slice(0, 10) : '';
      if (!start) return;
      var end = typeof ev.end === 'string' && ev.end ? ev.end.slice(0, 10) : start;
      var item = map.get(no);
      if (!item) {
        item = { no: no, count: 0, first: start, last: end, next: null, years: [], byYear: new Map(), types: {} };
        map.set(no, item);
      }
      item.count += 1;
      if (start < item.first) item.first = start;
      if (end > item.last) item.last = end;
      if (start >= tk && (item.next === null || start < item.next)) item.next = start;
      var y = num(ev.year, parseInt(start.slice(0, 4), 10));
      if (item.years.indexOf(y) < 0) item.years.push(y);
      var list = item.byYear.get(y);
      if (!list) { list = []; item.byYear.set(y, list); }
      list.push(ev);
      item.types[ev.type] = (item.types[ev.type] || 0) + 1;
    });
    map.forEach(function (item) {
      item.years.sort(function (a, b) { return a - b; });
      item.byYear.forEach(function (list) {
        list.sort(function (a, b) {
          var sa = String(a.start || ''), sb = String(b.start || '');
          if (sa !== sb) return sa < sb ? -1 : 1;
          return typeMeta(a.type).prio - typeMeta(b.type).prio;
        });
      });
    });
    return map;
  }

  /* ---------------- coverage：读取 / 推导 / 合并 ---------------- */

  /**
   * 本地推导 coverage（coverage.json 缺失时的降级路径，语义与契约一致）：
   *   status: ok(有事件) / no_info(有来源但零事件) / no_source(连来源都没有)
   * sourcesList 为 null 时表示「来源数未知」（file:// 下读不到 sources.json），
   * 此时只置 count 而 sources 记为 null，渲染层会换成不含数字的措辞。
   */
  function deriveCoverage(comps, events, sourcesList) {
    var evBy = eventStatsByNo(events);
    var srcCount = null;
    if (Array.isArray(sourcesList)) {
      srcCount = {};
      sourcesList.forEach(function (s) {
        if (!s) return;
        var no = normalizeNo(s.no);
        if (!no) return;
        srcCount[no] = (srcCount[no] || 0) + 1;
      });
    }
    var items = {};
    (comps || []).forEach(function (c) {
      var no = normalizeNo(c && c.no);
      if (!no) return;
      var st = evBy.get(no);
      var count = st ? st.count : 0;
      var sc = srcCount ? (srcCount[no] || 0) : null;
      var status = count > 0 ? 'ok' : (sc === 0 ? 'no_source' : 'no_info');
      items[no] = {
        no: no,
        sources: sc,
        events: count,
        first_event: st ? st.first : null,
        last_event: st ? st.last : null,
        next_event: st ? st.next : null,
        years: st ? st.years.slice() : [],
        status: status,
        note: '',
        derived: true
      };
    });
    return { generated_at: null, items: items, derived: true };
  }

  /** 把抓取管线产出的 coverage.json 覆盖到本地推导结果上（管线值优先，缺失字段保留推导值） */
  function mergeCoverage(base, official) {
    if (!official) return base;
    var items = official.items;
    if (!items) return base;
    var pick = function (no) {
      if (Object.prototype.hasOwnProperty.call(items, no)) return items[no];
      // items 可能是 {no: {...}} 或 [{no:...}, ...] 两种形态，都兜住
      if (Array.isArray(items)) {
        for (var i = 0; i < items.length; i++) {
          if (items[i] && normalizeNo(items[i].no) === no) return items[i];
        }
      }
      return null;
    };
    var out = {};
    Object.keys(base.items).forEach(function (no) {
      var b = base.items[no];
      var o = pick(no);
      if (!o) { out[no] = b; return; }
      out[no] = {
        no: no,
        sources: (typeof o.sources === 'number') ? o.sources : b.sources,
        events: (typeof o.events === 'number') ? o.events : b.events,
        first_event: o.first_event !== undefined ? o.first_event : b.first_event,
        last_event: o.last_event !== undefined ? o.last_event : b.last_event,
        next_event: o.next_event !== undefined ? o.next_event : b.next_event,
        years: b.years,
        status: o.status || b.status,
        note: o.note || b.note || '',
        derived: false
      };
    });
    return { generated_at: official.generated_at || null, items: out, derived: false };
  }

  /**
   * 「暂无报名信息」的副标题 / tooltip 文案。用户要求把话说清楚：
   * 抓到过来源就说来源数，一条时间信息都没有就直说，不静默留空。
   */
  function coverageNote(item) {
    if (!item) return '尚未抓取到该赛事的来源与时间信息。';
    var n = item.sources;
    if (n === null || n === undefined) {
      return '尚未发现时间信息（本次运行未读到 sources.json，无法显示来源条数）。';
    }
    if (n === 0) return '已抓 0 个来源，尚未发现时间信息。';
    return '已抓 ' + n + ' 个来源，尚未发现时间信息。';
  }

  /* ---------------- 数据加载 ---------------- */

  function embeddedEvents() {
    var doc = global.__EVENTS__;
    if (Array.isArray(doc)) return doc.length ? { events: doc, stats: null } : null;
    if (doc && Array.isArray(doc.events) && doc.events.length) return doc;
    return null;
  }

  function embeddedComps() {
    var doc = global.__COMPETITIONS__;
    if (Array.isArray(doc)) return doc.length ? doc : null;
    if (doc && Array.isArray(doc.competitions) && doc.competitions.length) return doc.competitions;
    return null;
  }

  function embeddedCoverage() {
    var doc = global.__COVERAGE__;
    if (!doc) return null;
    if (doc.items) return doc;
    if (Array.isArray(doc)) return { items: doc };
    return null;
  }

  function embeddedSources() {
    var doc = global.__SOURCES__;
    if (Array.isArray(doc)) return doc.length ? doc : null;
    if (doc && Array.isArray(doc.sources) && doc.sources.length) return doc.sources;
    return null;
  }

  function isHttp() {
    if (typeof location === 'undefined' || !location.protocol) return false;
    return location.protocol === 'http:' || location.protocol === 'https:';
  }

  function fetchJSON(url) {
    return fetch(url, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error(url + ' HTTP ' + res.status);
      return res.json();
    });
  }

  /**
   * 双通道加载。
   * @param {{base?:string}} opts base 默认 '../../data/'
   * @returns {Promise<{events:Array, comps:Array, coverage:Object, sources:Array|null,
   *                    diag:Array<string>, eventsOk:boolean, compsOk:boolean,
   *                    coverageSource:string}>}
   */
  function load(opts) {
    opts = opts || {};
    var base = opts.base || '../../data/';
    var diag = [];
    var canFetch = isHttp();

    var evDoc = embeddedEvents();
    if (evDoc) diag.push('✓ 事件数据：内嵌 ' + base + 'events.js（window.__EVENTS__，' + evDoc.events.length + ' 条）');
    else diag.push('✗ 内嵌 ' + base + 'events.js 不可用' +
      (global.__EVENTS_LOAD_ERROR__ ? '（' + global.__EVENTS_LOAD_ERROR__ + '）' : '') +
      (canFetch ? '，回退 fetch' : '；file:// 下不回退 fetch（避免 CORS 报错）'));

    var comps = embeddedComps();
    if (comps) diag.push('✓ 赛事档案：内嵌 ' + base + 'competitions.js（window.__COMPETITIONS__，' + comps.length + ' 项）');
    else diag.push('✗ 内嵌 ' + base + 'competitions.js 不可用' +
      (global.__COMPETITIONS_LOAD_ERROR__ ? '（' + global.__COMPETITIONS_LOAD_ERROR__ + '）' : '') +
      (canFetch ? '，回退 fetch' : '；file:// 下不回退 fetch'));

    var sources = embeddedSources();
    if (sources) diag.push('✓ 来源清单：内嵌 window.__SOURCES__（' + sources.length + ' 条）');

    var official = embeddedCoverage();
    if (official) diag.push('✓ coverage：内嵌 window.__COVERAGE__');

    var jobs = [];
    jobs.push(evDoc ? Promise.resolve(evDoc)
      : (canFetch ? fetchJSON(base + 'events.json').then(function (d) {
          diag.push('✓ fetch ' + base + 'events.json 成功');
          return d;
        }).catch(function (e) {
          diag.push('✗ fetch ' + base + 'events.json 失败：' + (e && e.message ? e.message : String(e)));
          return null;
        }) : Promise.resolve(null)));

    jobs.push(comps ? Promise.resolve(comps)
      : (canFetch ? fetchJSON(base + 'competitions.json').then(function (d) {
          diag.push('✓ fetch ' + base + 'competitions.json 成功');
          return d;
        }).catch(function (e) {
          diag.push('✗ fetch ' + base + 'competitions.json 失败：' + (e && e.message ? e.message : String(e)));
          return null;
        }) : Promise.resolve(null)));

    // sources.json 只用来推导「已抓 N 个来源」；file:// 下跳过（不回退 fetch）
    jobs.push(sources ? Promise.resolve(sources)
      : (canFetch ? fetchJSON(base + 'sources.json').then(function (d) {
          diag.push('✓ fetch ' + base + 'sources.json 成功（用于推算来源条数）');
          return Array.isArray(d) ? d : null;
        }).catch(function (e) {
          diag.push('✗ fetch ' + base + 'sources.json 失败：' + (e && e.message ? e.message : String(e)));
          return null;
        }) : Promise.resolve(null)));

    return Promise.all(jobs).then(function (r) {
      var eventsDoc = r[0], compsDoc = r[1], srcList = r[2];
      if (!eventsDoc && canFetch) diag.push('（事件数据不可用，页面会显示空状态）');

      var events = (eventsDoc && Array.isArray(eventsDoc.events)) ? eventsDoc.events : [];
      var compsArr = Array.isArray(compsDoc) ? compsDoc
        : (compsDoc && Array.isArray(compsDoc.competitions) ? compsDoc.competitions : []);
      var sourcesArr = Array.isArray(srcList) ? srcList : null;

      var derived = deriveCoverage(compsArr, events, sourcesArr);
      var coverage = mergeCoverage(derived, official);
      var coverageSource = official ? 'coverage.json（内嵌）'
        : (sourcesArr ? '本地推导（sources.json + events.json）' : '本地推导（仅 events.json）');
      diag.push('· coverage 来源：' + coverageSource);

      return {
        events: events,
        comps: compsArr,
        coverage: coverage,
        sources: sourcesArr,
        stats: (eventsDoc && eventsDoc.stats) ? eventsDoc.stats : null,
        generated_at: (eventsDoc && eventsDoc.generated_at) ? eventsDoc.generated_at : null,
        diag: diag,
        eventsOk: events.length > 0,
        compsOk: compsArr.length > 0,
        coverageSource: coverageSource
      };
    });
  }

  /* ---------------- 导出 ---------------- */

  global.HubData = {
    CATS: CATS, CAT_COLOR: CAT_COLOR, CAT_LABEL: CAT_LABEL, CAT_OTHER_COLOR: CAT_OTHER_COLOR,
    TYPES: TYPES, TYPE_META: TYPE_META,
    AUDIENCES: AUDIENCES, AUDIENCE_UNKNOWN: AUDIENCE_UNKNOWN,
    STATUS_LABEL: STATUS_LABEL,
    pad2: pad2, esc: esc, safeUrl: safeUrl, parseYMD: parseYMD, ymd: ymd, todayKey: todayKey,
    fmtDateCN: fmtDateCN, fmtMD: fmtMD, fmtDT: fmtDT, num: num,
    normalizeNo: normalizeNo, cmpNo: cmpNo, cmpDate: cmpDate,
    catColor: catColor, catClass: catClass, typeMeta: typeMeta, statusLabel: statusLabel,
    splitOrg: splitOrg, competitionOrgs: competitionOrgs, audienceOf: audienceOf,
    eventStatsByNo: eventStatsByNo,
    deriveCoverage: deriveCoverage, mergeCoverage: mergeCoverage, coverageNote: coverageNote,
    isHttp: isHttp, load: load
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = global.HubData;
})(typeof window !== 'undefined' ? window : this);
