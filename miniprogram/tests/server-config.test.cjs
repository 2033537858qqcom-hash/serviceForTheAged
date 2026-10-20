const test = require('node:test');
const assert = require('node:assert/strict');
const { createRuntime } = require('./page-harness.cjs');

function currentLanUrl() {
  return launch('ios').app.globalData.baseUrl;
}

function launch(platform, saved = {}, legacy = false) {
  const app = {};
  const storage = { ...saved };
  const wx = {
    getStorageSync: key => storage[key],
    setStorageSync: (key, value) => { storage[key] = value; },
    [legacy ? 'getSystemInfoSync' : 'getDeviceInfo']: () => ({ platform })
  };
  const rt = createRuntime(app, wx, undefined, { App: value => Object.assign(app, value, { globalData: structuredClone(value.globalData) }) });
  rt.require('app'); app.onLaunch();
  return { app, storage, rt };
}

test('App registers and starts even before common modules are injected', () => {
  const app = {};
  const rt = createRuntime(app, {
    getStorageSync() {}, getDeviceInfo: () => ({ platform: 'ios' })
  }, undefined, {
    require() { throw new Error('common modules have not been injected'); },
    App: value => Object.assign(app, value, { globalData: structuredClone(value.globalData) })
  });
  rt.require('app');
  assert.equal(typeof app.onLaunch, 'function', 'App must register without requiring a new module');
  app.onLaunch();
  const lan = currentLanUrl();
  assert.match(lan, /^http:\/\/\d+\.\d+\.\d+\.\d+:\d+\/api$/);
  assert.equal(app.globalData.baseUrl, lan);
  assert.deepEqual(Array.from(app.getServerUrls()), [lan]);
});

test('phone startup uses the computer LAN endpoint while the simulator uses localhost', () => {
  const lan = currentLanUrl();
  for (const platform of ['ios', 'android']) {
    const { app } = launch(platform);
    assert.equal(app.globalData.baseUrl, lan);
    assert.equal(app.globalData.platform, platform);
  }
  assert.equal(launch('devtools').app.globalData.baseUrl, 'http://localhost:8080/api');
});

test('phone startup migrates previously cached loopback addresses', () => {
  const lan = currentLanUrl();
  for (const url of ['http://localhost:8080/api', 'http://127.0.0.1:8080/api', 'http://[::1]:8080/api']) {
    const { app, storage } = launch('ios', { customBaseUrl: url });
    assert.equal(app.globalData.baseUrl, lan);
    assert.equal(storage.customBaseUrl, app.globalData.baseUrl);
  }
});

test('phone startup migrates any previously saved private LAN address after the computer changes networks', () => {
  const lan = currentLanUrl();
  for (const stale of ['http://10.0.151.146:8080/api', 'http://192.168.1.8:8080/api', 'http://172.16.0.9:8080/api']) {
    const { app, storage } = launch('ios', { customBaseUrl: stale });
    assert.equal(app.globalData.baseUrl, lan);
    assert.equal(storage.customBaseUrl, lan);
  }
});

test('explicit remote endpoints and restored login preferences remain intact', () => {
  const saved = { customBaseUrl: 'https://care.example.com/api', token: 'signed-in', userInfo: { role: 'STAFF' }, isElderMode: true };
  const { app, storage } = launch('android', saved);
  assert.equal(app.globalData.baseUrl, saved.customBaseUrl);
  assert.equal(storage.customBaseUrl, saved.customBaseUrl);
  assert.equal(app.globalData.token, 'signed-in');
  assert.equal(app.globalData.role, 'STAFF');
  assert.equal(app.globalData.isElderMode, true);
});

test('legacy device detection still chooses the phone endpoint', () => {
  assert.equal(launch('android', {}, true).app.globalData.baseUrl, currentLanUrl());
});

test('the phone server menu does not offer local loopback addresses', () => {
  let options;
  const { app } = launch('ios');
  const page = createRuntime(app, { showActionSheet: value => { options = value; } }).page('user/profile');
  page.changeServerUrl();
  assert.equal(options.itemList.length, 2);
  assert.equal(options.itemList.some(item => item.includes('localhost') || item.includes('127.0.0.1')), false);
});

test('a blocked network request does not open a misleading WeChat authorization fallback', async () => {
  const requests = []; let modals = 0;
  const app = { globalData: { baseUrl: currentLanUrl(), token: '' } };
  const wx = {
    login: options => options.success({ code: 'test-code' }),
    request: options => requests.push(options), showLoading() {}, hideLoading() {}, showToast() {},
    showModal() { modals++; }
  };
  const rt = createRuntime(app, wx, null, { console: { error() {} } });
  const page = rt.page('auth/login'); page.data.isAgreed = true;
  page.handleQuickLogin();
  requests[0].fail({ errMsg: 'request:fail url not in domain list', errno: 600002 });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(modals, 0);
});

test('a connection timeout tells the user to check WiFi and the LAN address', async () => {
  const requests = []; const toasts = [];
  const app = { globalData: { baseUrl: currentLanUrl(), token: '' } };
  const wx = {
    login: options => options.success({ code: 'test-code' }),
    request: options => requests.push(options), showLoading() {}, hideLoading() {},
    showToast: options => toasts.push(options), showModal() {}
  };
  const rt = createRuntime(app, wx, null, { console: { error() {} } });
  const page = rt.page('auth/login'); page.data.isAgreed = true;
  page.handleQuickLogin();
  requests[0].fail({ errMsg: 'request:fail -118:net::ERR_CONNECTION_TIMED_OUT', errno: 600001 });
  await new Promise(resolve => setImmediate(resolve));
  assert.match(toasts.at(-1).title, /同一WiFi|服务地址/);
});
