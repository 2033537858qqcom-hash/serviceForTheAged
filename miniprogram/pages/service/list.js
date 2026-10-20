const request = require('../../utils/request.js');
const app = getApp();

Page({
  data: {
    isElderMode: false,
    selectedCat: '',
    services: []
  },

  onLoad(options) {
    if (options && options.category) {
      this.setData({ selectedCat: options.category });
    }
  },

  onShow() {
    this.setData({ isElderMode: app.globalData.isElderMode });
    this.loadServices();
  },

  changeCat(e) {
    const cat = e.currentTarget.dataset.cat;
    this.setData({ selectedCat: cat });
    this.loadServices();
  },

  loadServices() {
    request.get('/service-items/list-available', { category: this.data.selectedCat })
      .then(data => {
        this.setData({ services: data || [] });
      });
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/service/detail?id=${id}`
    });
  },

  quickBook(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/order/create?serviceId=${id}`
    });
  }
});
