/* Shared, dependency-free helpers for the three resource modules. */
(function (root) {
  'use strict';
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function safeUrl(value) {
    if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) return '';
    try { var url = new URL(value); return url.username || url.password ? '' : url.href; }
    catch (e) { return ''; }
  }
  function matches(item, query) {
    var haystack = Object.keys(item).filter(function (key) { return !/url/i.test(key); })
      .map(function (key) { return String(item[key] == null ? '' : item[key]); }).join(' ').toLowerCase();
    return String(query || '').trim().toLowerCase().split(/\s+/).every(function (word) { return haystack.indexOf(word) >= 0; });
  }
  function filter(items, state) {
    return items.filter(function (item) {
      return (!state.category || item.category === state.category) &&
        (!state.org || item.org === state.org) &&
        (!state.college || item.college === state.college) && matches(item, state.q);
    }).slice().sort(function (a, b) {
      return state.sort === 'name' ? a.title.localeCompare(b.title, 'zh-CN') :
        String(b.date || '').localeCompare(String(a.date || '')) || a.title.localeCompare(b.title, 'zh-CN');
    });
  }
  function external(url, label, cls) {
    var safe = safeUrl(url);
    return safe ? '<a class="' + esc(cls || '') + '" href="' + esc(safe) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + '<span aria-hidden="true"> ↗</span></a>' : '';
  }
  var api = { esc: esc, safeUrl: safeUrl, matches: matches, filter: filter, external: external };
  root.ResourceCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
