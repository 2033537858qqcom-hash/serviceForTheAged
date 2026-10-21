const LOGIN = '/pages/auth/login';
const HOME = '/pages/index/index';
const WORKBENCH = '/pages/staff/workbench';
const TAB_PAGES = [HOME, '/pages/service/list', '/pages/order/list', '/pages/user/profile', WORKBENCH];
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

function requireRole(allowedRoles, returnUrl) {
  if (!requireLogin(returnUrl)) return false;
  let app = null;
  try { app = getApp(); } catch (_) {}
  const role = app?.globalData?.role || app?.globalData?.userInfo?.role || 'RESIDENT';
  if (Array.isArray(allowedRoles) && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    if (typeof wx !== 'undefined' && wx.showToast) {
      wx.showToast({ title: '无权访问该角色页面', icon: 'none' });
    }
    const fallback = role === 'STAFF' ? WORKBENCH : HOME;
    if (TAB_PAGES.includes(fallback)) {
      route('switchTab', { url: fallback }, true);
    } else {
      route('redirectTo', { url: fallback }, true);
    }
    return false;
  }
  return true;
}

// 居民专属 tab 页（首页 / 服务 / 订单）：服务人员经分享链接或返回栈进入时送回工作台
function redirectStaffHome() {
  let app = null;
  try { app = getApp(); } catch (_) {}
  const role = app?.globalData?.role || app?.globalData?.userInfo?.role;
  if (!app?.globalData?.token || role !== 'STAFF') return false;
  route('switchTab', { url: WORKBENCH }, true);
  return true;
}

function afterLogin(returnUrl) {
  let app = null;
  try { app = getApp(); } catch (_) {}
  const role = app?.globalData?.role || app?.globalData?.userInfo?.role || 'RESIDENT';

  if (role === 'ADMIN') {
    if (typeof wx !== 'undefined' && wx.showToast) {
      wx.showToast({ title: '管理员请前往电脑端管理平台', icon: 'none' });
    }
    return false;
  }

  let target = /^\/pages\/[\w/-]+(?:\?.*)?$/.test(returnUrl || '') && !returnUrl.startsWith(LOGIN) ? returnUrl : null;
  if (!target) {
    target = role === 'STAFF' ? WORKBENCH : HOME;
  } else {
    // 角色边界矫正
    const path = target.split('?')[0];
    if (role === 'STAFF' && (path === HOME || path === '/pages/order/create' || path === '/pages/user/family' || path === '/pages/user/elder-form')) {
      target = WORKBENCH;
    } else if (role === 'RESIDENT' && path === WORKBENCH) {
      target = HOME;
    }
  }

  const path = target.split('?')[0];
  if (TAB_PAGES.includes(path)) return route('switchTab', { url: path }, true);
  return route('redirectTo', { url: target }, true);
}

module.exports = { navigateTo, switchTab, redirectTo, navigateBack, toLogin, requireLogin, requireRole, redirectStaffHome, afterLogin, currentUrl };
