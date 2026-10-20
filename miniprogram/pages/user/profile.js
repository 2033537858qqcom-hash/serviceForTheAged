const request = require('../../utils/request.js');
const app = getApp();

Page({
  data: {
    userInfo: null,
    isElderMode: false,
    roleTextMap: {
      'ADMIN': '系统管理员',
      'STAFF': '服务人员',
      'RESIDENT': '社区居民'
    }
  },

  onShow() {
    this.setData({
      userInfo: app.globalData.userInfo,
      isElderMode: app.globalData.isElderMode
    });
  },

  onModeChange(e) {
    const isElder = e.detail.value;
    app.toggleElderMode(isElder);
    this.setData({ isElderMode: isElder });
  },

  quickLogin(e) {
    const username = e.currentTarget.dataset.user;
    request.post('/auth/mock-login', null, {
      params: { username }
    }).then(res => {
      app.globalData.token = res.token;
      app.globalData.userInfo = res.userInfo;
      app.globalData.role = res.userInfo.role;
      wx.setStorageSync('token', res.token);
      wx.setStorageSync('userInfo', res.userInfo);

      this.setData({ userInfo: res.userInfo });
      wx.showToast({ title: `已切换为 ${res.userInfo.realName}`, icon: 'success' });
    });
  },

  logout() {
    app.globalData.token = '';
    app.globalData.userInfo = null;
    app.globalData.role = 'RESIDENT';
    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
    this.setData({ userInfo: null });
    wx.showToast({ title: '已退出登录', icon: 'none' });
  },

  goToElderList() {
    wx.navigateTo({ url: '/pages/user/elder-form' });
  },

  goToFamily() {
    wx.navigateTo({ url: '/pages/user/family' });
  },

  goToWorkbench() {
    wx.navigateTo({ url: '/pages/staff/workbench' });
  }
});
