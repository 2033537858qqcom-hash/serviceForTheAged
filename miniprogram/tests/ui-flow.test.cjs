const test = require('node:test');
const assert = require('node:assert/strict');
const { createRuntime } = require('./page-harness.cjs');
function loadPage(name, app, wx = {}, request) { return createRuntime(app, wx, request).page(name); }

test('a home service shortcut uses switchTab and consumes its category once', () => {
  const app = { globalData: { isElderMode: false } };
  let target;
  const home = loadPage('index/index', app, { switchTab: value => { target = value.url; } });
  home.goToService({ currentTarget: { dataset: { category: 'MEAL' } } });
  assert.equal(target, '/pages/service/list');
  const list = loadPage('service/list', app);
  list.onLoad();
  list.loadServices = () => {};
  list.onShow();
  assert.equal(list.data.selectedCat, 'MEAL');
  assert.equal(app.globalData.serviceCategory, '');
  list.changeCat({ currentTarget: { dataset: { index: 2 } } });
  list.onAnimationFinish({ detail: { current: 2 } });
  list.onShow();
  assert.equal(list.data.selectedCat, 'CLEANING');
});

test('large text preference is shared by the home and profile pages', () => {
  const app = { globalData: { isElderMode: false }, toggleElderMode(value) { this.globalData.isElderMode = value; } };
  const home = loadPage('index/index', app);
  home.toggleMode();
  assert.equal(app.globalData.isElderMode, true);
  const profile = loadPage('user/profile', app);
  profile.onShow();
  assert.equal(profile.data.isElderMode, true);
  profile.onModeChange({ detail: { value: false } });
  assert.equal(app.globalData.isElderMode, false);
});

test('the home clears a previous active order when logged out', () => {
  const app = { globalData: { token: '' } };
  const home = loadPage('index/index', app);
  home.data.activeOrder = { order: { id: 'previous-user-order' } };
  home.loadActiveOrder();
  assert.equal(home.data.activeOrder, null);
});

test('login, cancel, confirm and logout open a bottom sheet', async () => {
  const dialogs = [];
  const taps = [];
  const posts = [];
  const wx = {
    showModal() { dialogs.push('modal'); },
    showActionSheet() { dialogs.push('action'); },
    showToast() {},
    vibrateShort() { taps.push('light'); }
  };
  const detail = loadPage('service/detail', { globalData: { token: '' } }, wx);
  detail.data.serviceId = '3';
  detail.goToBook();
  assert.equal(detail.data.loginSheet, true);
  assert.equal(taps.length, 1);
  detail.closeLoginSheet();
  assert.equal(detail.data.loginSheet, false);

  const runtime = createRuntime({ globalData: { token: 't' } }, wx, {
    post: async (url, body) => { posts.push({ url, body }); return {}; },
    get: async () => ({ order: { id: '9', status: 'COMPLETED' } })
  });
  const order = runtime.page('order/detail');
  order.data.orderId = '9';
  order.cancelOrder();
  assert.equal(order.data.cancelSheet, true);
  order.closeCancelSheet();
  order.confirmOrder();
  assert.equal(order.data.confirmSheet, true);
  await order.submitConfirm();
  assert.equal(order.data.confirmSheet, false);
  assert.equal(posts[0].url, '/fulfillment/confirm');
  assert.equal(posts[0].body.orderId, '9');

  const profile = loadPage('user/profile', { globalData: {} }, wx);
  profile.confirmLogout();
  assert.equal(profile.data.logoutSheet, true);
  assert.deepEqual(dialogs, []);
});

test('the service preview leaves loading state on request failure', async () => {
  const home = loadPage('index/index', { globalData: {} }, {}, { get: () => Promise.reject(new Error('offline')) });
  home.loadServiceItems();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(home.data.serviceError, true);
  assert.equal(home.data.servicesLoading, false);
});
