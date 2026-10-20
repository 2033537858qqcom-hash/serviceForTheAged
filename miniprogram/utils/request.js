// utils/request.js
const app = getApp();

function request(options) {
  return new Promise((resolve, reject) => {
    const token = (getApp() && getApp().globalData.token) || wx.getStorageSync('token') || '';
    const baseUrl = (getApp() && getApp().globalData.baseUrl) || 'http://localhost:8080/api';

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
            wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
            wx.removeStorageSync('token');
            wx.removeStorageSync('userInfo');
            reject(apiRes);
          } else {
            wx.showToast({ title: apiRes.message || '服务异常', icon: 'none' });
            reject(apiRes);
          }
        } else {
          wx.showToast({ title: '网络连接失败(' + res.statusCode + ')', icon: 'none' });
          reject(res);
        }
      },
      fail(err) {
        wx.showToast({ title: '服务器网络连接超时', icon: 'none' });
        reject(err);
      }
    });
  });
}

module.exports = {
  get: (url, data, header) => request({ url, method: 'GET', data, header }),
  post: (url, data, header) => request({ url, method: 'POST', data, header }),
  put: (url, data, header) => request({ url, method: 'PUT', data, header }),
  del: (url, data, header) => request({ url, method: 'DELETE', data, header })
};
