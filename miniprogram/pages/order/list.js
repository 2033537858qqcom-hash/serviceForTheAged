const request = require('../../utils/request.js');
const app = getApp();

Page({
  data: {
    statusTab: '',
    orders: [],
    pageNum: 1,
    pageSize: 10,
    hasMore: true,
    isElderMode: false,
    statusTextMap: {
      'WAIT_DISPATCH': '待派单',
      'WAIT_ACCEPT': '待接单',
      'WAIT_VISIT': '待上门',
      'IN_SERVICE': '服务中',
      'WAIT_CONFIRM': '待确认',
      'COMPLETED': '已完成',
      'WAIT_MANUAL': '待人工处理',
      'CANCELLED': '已取消'
    },
    statusTagMap: {
      'WAIT_DISPATCH': 'tag-warning',
      'WAIT_ACCEPT': 'tag-warning',
      'WAIT_VISIT': 'tag-info',
      'IN_SERVICE': 'tag-info',
      'WAIT_CONFIRM': 'tag-warning',
      'COMPLETED': 'tag-success',
      'WAIT_MANUAL': 'tag-danger',
      'CANCELLED': 'tag-danger'
    }
  },

  onShow() {
    this.setData({ isElderMode: app.globalData.isElderMode });
    this.loadOrders(true);
  },

  onPullDownRefresh() {
    this.loadOrders(true);
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    if (this.data.hasMore) {
      this.setData({ pageNum: this.data.pageNum + 1 }, () => {
        this.loadOrders(false);
      });
    }
  },

  changeTab(e) {
    const status = e.currentTarget.dataset.status;
    this.setData({ statusTab: status, pageNum: 1 }, () => {
      this.loadOrders(true);
    });
  },

  loadOrders(reset = false) {
    if (!app.globalData.token) return;

    const { pageNum, pageSize, statusTab } = this.data;
    request.get('/orders/page', {
      pageNum: reset ? 1 : pageNum,
      pageSize,
      status: statusTab || null
    }).then(data => {
      const records = (data && data.records) || [];
      this.setData({
        orders: reset ? records : this.data.orders.concat(records),
        hasMore: records.length === pageSize,
        pageNum: reset ? 1 : pageNum
      });
    });
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/order/detail?id=${id}`
    });
  },

  noAction() {}
});
