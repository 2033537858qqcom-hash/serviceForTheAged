const request = require('../../utils/request.js');
const app = getApp();

Page({
  data: {
    serviceId: null,
    service: null,
    isElderMode: false
  },

  onLoad(options) {
    if (options && options.id) {
      this.setData({ serviceId: options.id });
      this.loadServiceDetail(options.id);
    }
  },

  onShow() {
    this.setData({ isElderMode: app.globalData.isElderMode });
  },

  loadServiceDetail(id) {
    request.get(`/service-items/${id}`).then(data => {
      this.setData({ service: data });
    });
  },

  goToBook() {
    if (!app.globalData.token) {
      wx.showModal({
        title: '提示',
        content: '预约服务请先登录',
        confirmText: '去登录',
        success(res) {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/user/profile' });
          }
        }
      });
      return;
    }
    wx.navigateTo({
      url: `/pages/order/create?serviceId=${this.data.serviceId}`
    });
  }
});
