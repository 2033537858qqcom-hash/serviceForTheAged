// app.js
App({
  globalData: {
    baseUrl: 'http://localhost:8080/api', // 开发/联调默认地址
    userInfo: null,
    token: '',
    role: 'RESIDENT',
    isElderMode: false // 适老化关爱模式
  },

  onLaunch() {
    // 恢复本地存储的登录态
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    const isElderMode = wx.getStorageSync('isElderMode') || false;

    if (token) {
      this.globalData.token = token;
      this.globalData.userInfo = userInfo;
      this.globalData.role = userInfo ? userInfo.role : 'RESIDENT';
    }
    this.globalData.isElderMode = isElderMode;
  },

  toggleElderMode(enable) {
    this.globalData.isElderMode = enable;
    wx.setStorageSync('isElderMode', enable);
  }
});
