const LOGIN = '/pages/auth/login';
const HOME = '/pages/index/index';
const TAB_PAGES = [HOME, '/pages/service/list', '/pages/order/list', '/pages/user/profile'];
let active = null;
let priorityAfterRoute = null;

function pages() {
  return typeof getCurrentPages === 'function' ? getCurrentPages() : [];
}

function currentUrl() {
  const stack = pages();
  const page = stack[stack.length - 1];
  if (!page) return '';
  const query = Object.keys(page.options || {}).map(key => `${encodeURIComponent(key)}=${encodeURIComponent(page.options[key])}`).join('&');
  return '/' + page.route + (query ? '?' + query : '');
}

// One native route transition at a time. No timers or animation delays before opening.
function route(method, options = {}, priority = false) {
  if (active) {
    if (priority && active.url !== options.url) priorityAfterRoute = { method, options };
    else if (priority) return false;
    else {
      const result = { errMsg: method + ':fail navigation in progress' };
      options.fail?.(result);
      options.complete?.(result);
    }
    return false;
  }
  const job = { url: options.url || '' };
  active = job;
  const finish = result => {
    if (active !== job) return;
    active = null;
    const next = priorityAfterRoute;
    priorityAfterRoute = null;
    options.complete?.(result);
    if (next) route(next.method, next.options, true);
  };
  try {
    wx[method]({ ...options, complete: finish });
  } catch (error) {
    try { options.fail?.(error); } finally { finish(error); }
  }
  return true;
}

function navigateTo(options) {
  if (currentUrl() === options.url) return false;
  return route('navigateTo', options);
}
function switchTab(options) { return route('switchTab', options); }
function redirectTo(options) { return route('redirectTo', options); }
function navigateBack(options = {}) {
  const { fallbackUrl, ...nativeOptions } = options;
  if (!fallbackUrl) return route('navigateBack', nativeOptions);
  if (typeof getCurrentPages === 'function' && pages().length <= 1) return afterLogin(fallbackUrl);
  return route('navigateBack', {
    ...nativeOptions,
    fail(error) {
      nativeOptions.fail?.(error);
      if (!error?.errMsg?.includes('navigation in progress')) afterLogin(fallbackUrl);
    }
  });
}

function toLogin(returnUrl = currentUrl() || HOME) {
  if (active?.url.startsWith(LOGIN)) return false;
  if (currentUrl().split('?')[0] === LOGIN) return false;
  const current = currentUrl().split('?')[0];
  // Keep tab instances alive; replace an unauthenticated detail page to avoid back/login loops.
  const method = TAB_PAGES.includes(current) || !current ? 'navigateTo' : 'redirectTo';
  return route(method, { url: LOGIN + '?redirect=' + encodeURIComponent(returnUrl) }, true);
}

function requireLogin(returnUrl) {
  let app = null;
  try { app = getApp(); } catch (_) {}
  if (app?.globalData?.token) return true;
  toLogin(returnUrl);
  return false;
}

function afterLogin(returnUrl) {
  const target = /^\/pages\/[\w/-]+(?:\?.*)?$/.test(returnUrl || '') && !returnUrl.startsWith(LOGIN) ? returnUrl : HOME;
  const path = target.split('?')[0];
  if (TAB_PAGES.includes(path)) return route('switchTab', { url: path }, true);
  return route('redirectTo', { url: target }, true);
}

module.exports = { navigateTo, switchTab, redirectTo, navigateBack, toLogin, requireLogin, afterLogin, currentUrl };
