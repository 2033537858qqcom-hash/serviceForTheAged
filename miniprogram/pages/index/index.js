// pages/index/index.js
const request = require('../../utils/request.js');
const app = getApp();

Page({
  data: {
    isElderMode: false,
    isStaff: false,
    serviceItems: [],
    activeOrder: null,
    statusTextMap: {
      'WAIT_DISPATCH': '待派单',
      'WAIT_ACCEPT': '待接单',
      'WAIT_VISIT': '待上门',
      'IN_SERVICE': '服务中',
      'WAIT_CONFIRM': '待确认',
      'COMPLETED': '已完成',
      'WAIT_MANUAL': '待人工处理',
      'CANCELLED': '已取消'
    }
  },

  onShow() {
    this.setData({
      isElderMode: app.globalData.isElderMode,
      isStaff: app.globalData.role === 'STAFF'
    });
    this.loadServiceItems();
    this.loadActiveOrder();
  },

  onPullDownRefresh() {
    this.loadServiceItems();
    this.loadActiveOrder();
    wx.stopPullDownRefresh();
  },

  onModeChange(e) {
    const isElder = e.detail.value;
    app.toggleElderMode(isElder);
    this.setData({ isElderMode: isElder });
  },

  toggleMode() {
    const isElder = !this.data.isElderMode;
    app.toggleElderMode(isElder);
    this.setData({ isElderMode: isElder });
  },

  loadServiceItems() {
    request.get('/service-items/list-available').then(data => {
      this.setData({ serviceItems: data || [] });
    }).catch(err => {
      console.log('获取服务列表失败', err);
    });
  },

  loadActiveOrder() {
    if (!app.globalData.token) return;
    request.get('/orders/page', { pageNum: 1, pageSize: 5 }).then(data => {
      if (data && data.records && data.records.length > 0) {
        // 查找一条进行中的订单
        const active = data.records.find(item => 
          ['WAIT_DISPATCH', 'WAIT_ACCEPT', 'WAIT_VISIT', 'IN_SERVICE', 'WAIT_CONFIRM'].includes(item.order.status)
        );
        this.setData({ activeOrder: active || null });
      } else {
        this.setData({ activeOrder: null });
      }
    }).catch(() => {});
  },

  callHotline() {
    wx.makePhoneCall({
      phoneNumber: '010-88886666',
      fail() {
        wx.showModal({
          title: '社区服务热线',
          content: '010-88886666 (工作时间 08:00 - 20:00)',
          showCancel: false
        });
      }
    });
  },

  goToService(e) {
    const category = e.currentTarget.dataset.category;
    wx.navigateTo({
      url: `/pages/service/list?category=${category}`
    });
  },

  goToServiceList() {
    wx.switchTab({
      url: '/pages/service/list'
    });
  },

  goToServiceDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/service/detail?id=${id}`
    });
  },

  goToOrderDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/order/detail?id=${id}`
    });
  },

  goToWorkbench() {
    wx.navigateTo({
      url: '/pages/staff/workbench'
    });
  }
});
