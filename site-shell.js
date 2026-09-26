/* Shared subpage chrome. Load with defer; only the two opt-in containers are changed. */
(function () {
  'use strict';

  // Capture while this script is executing, before DOMContentLoaded clears currentScript.
  // Resolving against the script, not the document, works under both HTTP and file://.
  var script = document.currentScript;
  // Standalone exports may inline this script. Never guess a site root from the
  // document URL: that would generate broken logos and local navigation links.
  if (!script || !script.src || script.hasAttribute('data-site-standalone')) return;
  var webRoot;
  try {
    webRoot = new URL('./', script.src);
    if (!/^(https?:|file:)$/.test(webRoot.protocol)) return;
  } catch (error) {
    return;
  }
  var routes = [
    { page: 'home', label: '网站首页', path: 'index.html' },
    { page: 'calendar', label: '竞赛日历', path: 'calendar/index.html' },
    { page: 'competitions', label: '赛事总览', path: 'competitions/index.html' },
    { page: 'history', label: '历年情况', path: 'history/index.html' },
    { page: 'policy', label: '官网政策', path: 'policy/index.html' },
    { page: 'qq', label: 'QQ群与频道', path: 'qq/index.html' }
  ];

  function element(tag, className, text) {
    var node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function localUrl(path) {
    return new URL(path, webRoot).href;
  }

  function externalLink(label, href) {
    var link = element('a', 'site-footer-link', label);
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  }

  function renderHeader(container, currentPage) {
    if (container.getAttribute('data-site-mounted') === 'true') return;
    var masthead = element('header', 'site-masthead');
    var inner = element('div', 'site-wrap site-masthead-inner');
    var brand = element('a', 'site-brand');
    brand.href = localUrl('index.html');
    brand.setAttribute('aria-label', '武科大资源汇总站首页 · 学生共建，非官方');

    var logo = element('img', 'site-university-logo');
    logo.src = localUrl('demo/assets/logo.png');
    logo.width = 456;
    logo.height = 103;
    logo.alt = '武汉科技大学 Wuhan University of Science and Technology';
    var divider = element('span', 'site-brand-divider');
    divider.setAttribute('aria-hidden', 'true');
    var title = element('span', 'site-brand-title');
    title.appendChild(element('strong', 'site-brand-name', '资源汇总站'));
    title.appendChild(element('span', 'site-brand-identity', '学生共建 · 非官方'));
    brand.appendChild(logo);
    brand.appendChild(divider);
    brand.appendChild(title);
    inner.appendChild(brand);
    masthead.appendChild(inner);

    var nav = element('nav', 'site-nav');
    nav.setAttribute('aria-label', '主导航');
    var navInner = element('div', 'site-wrap site-nav-inner');
    routes.forEach(function (route) {
      var link = element('a', 'site-nav-link', route.label);
      link.href = localUrl(route.path);
      if (route.page === currentPage) link.setAttribute('aria-current', 'page');
      navInner.appendChild(link);
    });
    nav.appendChild(navInner);
    container.replaceChildren(masthead, nav);
    container.setAttribute('data-site-mounted', 'true');
  }

  function renderFooter(container) {
    if (container.getAttribute('data-site-mounted') === 'true') return;
    var footer = element('footer', 'site-footer');
    var inner = element('div', 'site-wrap site-footer-inner');
    var copy = element('div', 'site-footer-copy');
    copy.appendChild(element('p', 'site-footer-title', '武科大资源汇总站 · 学生共建 · 非官方'));
    copy.appendChild(element('p', 'site-footer-note', '汇集公开赛事与学校资源；报名、认定及后续变更，请以学校和主办方原文为准。'));
    var links = element('div', 'site-footer-links');
    links.appendChild(externalLink('学校官网', 'https://www.wust.edu.cn/'));
    links.appendChild(externalLink('创新创业学院', 'https://cxcy.wust.edu.cn/'));
    var home = element('a', 'site-footer-link', '网站首页');
    home.href = localUrl('index.html');
    links.appendChild(home);
    inner.appendChild(copy);
    inner.appendChild(links);
    footer.appendChild(inner);
    container.replaceChildren(footer);
    container.setAttribute('data-site-mounted', 'true');
  }

  function mount() {
    // The exporter can opt out even when it retains an external script URL.
    if (document.documentElement.hasAttribute('data-site-standalone') ||
        (document.body && document.body.hasAttribute('data-site-standalone'))) return;
    var page = document.body && document.body.getAttribute('data-page');
    // Homepage owns its existing header/footer; unknown pages must opt in explicitly.
    if (!/^(calendar|competitions|competition|history|policy|qq)$/.test(page || '')) return;
    var currentPage = page === 'competition' ? 'competitions' : page;
    var header = document.querySelector('[data-site-header]');
    var footer = document.querySelector('[data-site-footer]');
    if (header) renderHeader(header, currentPage);
    if (footer) renderFooter(footer);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
