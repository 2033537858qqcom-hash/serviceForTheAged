// 登录会话的唯一读写入口：未登录时角色为空字符串，不再默认成 RESIDENT。
function getRole(app) {
  const state = (app && app.globalData) || {};
  return state.role || (state.userInfo && state.userInfo.role) || '';
}

function isLoggedIn(app) {
  return Boolean(app && app.globalData && app.globalData.token);
}

function clearSession(app) {
  if (app && app.globalData) {
    app.globalData.token = '';
    app.globalData.userInfo = null;
    app.globalData.role = '';
  }
  if (typeof wx !== 'undefined' && wx.removeStorageSync) {
    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
  }
}

module.exports = { getRole, isLoggedIn, clearSession };
