// utils/request.js
const { toLogin } = require('./navigation.js');

function expireSession(app, token, baseUrl) {
  const state = app.globalData;
  // A late response from a previous account/server must not log out the current account.
  if (state.token !== token || state.baseUrl !== baseUrl) return;
  state.token = '';
  state.userInfo = null;
  state.role = 'RESIDENT';
  wx.removeStorageSync('token');
  wx.removeStorageSync('userInfo');
  wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
  toLogin();
}

function request(options) {
  return new Promise((resolve, reject) => {
    const app = getApp();
    const token = app.globalData.token || '';
    const baseUrl = (app && app.globalData && app.globalData.baseUrl) || wx.getStorageSync('customBaseUrl') || 'http://localhost:8080/api';

    wx.request({
      url: baseUrl + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? 'Bearer ' + token : '',
        ...options.header
      },
      success(res) {
        if (res.statusCode === 200) {
          const apiRes = res.data;
          if (apiRes.code === 200) {
            resolve(apiRes.data);
          } else if (apiRes.code === 401) {
            if (token && !options.url.startsWith('/auth/')) expireSession(app, token, baseUrl);
            else if (!token || options.url.startsWith('/auth/')) wx.showToast({ title: apiRes.message || '请先登录', icon: 'none' });
            reject(apiRes);
          } else {
            wx.showToast({ title: apiRes.message || '服务异常', icon: 'none' });
            reject(apiRes);
          }
        } else if (res.statusCode === 401) {
          if (token && !options.url.startsWith('/auth/')) expireSession(app, token, baseUrl);
          else wx.showToast({ title: res.data?.message || (options.url.startsWith('/auth/') ? '请检查账号和密码' : '请先登录'), icon: 'none' });
          reject(res);
        } else {
          wx.showToast({ title: '网络连接失败(' + res.statusCode + ')', icon: 'none' });
          reject(res);
        }
      },
      fail(err) {
        console.error('[API请求失败]', options.method || 'GET', baseUrl + options.url, err);
        const errMsg = (err && err.errMsg) || '';
        let tip = '服务器网络连接超时';
        if (errMsg.includes('url not in domain list')) {
          tip = '请在微信开发者工具勾选“不校验合法域名”';
        } else if (errMsg.includes('refused')) {
          tip = '连接被拒绝，请确认后端8080已启动';
        } else if (/TIMED_OUT|timeout/i.test(errMsg)) {
          tip = '连不上电脑后端，请确认同一WiFi并更新服务地址';
        }
        wx.showToast({ title: tip, icon: 'none', duration: 3000 });
        reject({ ...err, isNetworkError: true });
      }
    });
  });
}

module.exports = {
  request,
  get: (url, data, header) => request({ url, method: 'GET', data, header }),
  post: (url, data, header) => request({ url, method: 'POST', data, header }),
  put: (url, data, header) => request({ url, method: 'PUT', data, header }),
  del: (url, data, header) => request({ url, method: 'DELETE', data, header })
};
