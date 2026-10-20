const request = require('../../utils/request.js');
const app = getApp();

Page({
  data: {
    orderId: null,
    orderVO: null,
    canCancel: false,
    isElderMode: false,
    statusTextMap: {
      'WAIT_DISPATCH': '待派单',
      'WAIT_ACCEPT': '待接单',
      'WAIT_VISIT': '待上门',
      'IN_SERVICE': '服务中',
      'WAIT_CONFIRM': '待确认完成',
      'COMPLETED': '已完成',
      'WAIT_MANUAL': '待人工协调',
      'CANCELLED': '已取消'
    },
    statusSubMap: {
      'WAIT_DISPATCH': '系统正在为您匹配符合技能与时间要求的师傅',
      'WAIT_ACCEPT': '已向服务人员发送派单通知，等待确认接单',
      'WAIT_VISIT': '师傅已接单，正在准备并按时上门履约',
      'IN_SERVICE': '服务师傅已到达现场，正在提供照护服务',
      'WAIT_CONFIRM': '师傅已完成服务并提交记录，请您核实确认',
      'COMPLETED': '服务已顺利完成，感谢您对社区养老工作的信任',
      'WAIT_MANUAL': '暂时暂无匹配人员，社区管理员正在人工协调处置',
      'CANCELLED': '该订单已按规则取消，排班预留已释放'
    }
  },

  onLoad(options) {
    if (options && options.id) {
      this.setData({ orderId: options.id });
    }
  },

  onShow() {
    this.setData({ isElderMode: app.globalData.isElderMode });
    if (this.data.orderId) {
      this.loadDetail(this.data.orderId);
    }
  },

  onPullDownRefresh() {
    this.loadDetail(this.data.orderId);
    wx.stopPullDownRefresh();
  },

  loadDetail(id) {
    request.get(`/orders/${id}`).then(data => {
      const order = data.order;
      const canCancel = ['WAIT_DISPATCH', 'WAIT_ACCEPT', 'WAIT_VISIT', 'WAIT_MANUAL'].includes(order.status);
      this.setData({
        orderVO: data,
        canCancel
      });
    });
  },

  callStaff() {
    const staffPhone = this.data.orderVO.currentStaff.user.phone;
    if (staffPhone) {
      wx.makePhoneCall({ phoneNumber: staffPhone });
    }
  },

  cancelOrder() {
    const that = this;
    wx.showModal({
      title: '取消预约订单',
      content: '服务尚未开始，确定要取消这笔订单吗？',
      confirmColor: '#ff4d4f',
      success(res) {
        if (res.confirm) {
          request.post(`/orders/${that.data.orderId}/cancel`).then(() => {
            wx.showToast({ title: '订单已取消', icon: 'success' });
            that.loadDetail(that.data.orderId);
          });
        }
      }
    });
  },

  confirmOrder() {
    const that = this;
    wx.showModal({
      title: '确认服务完成',
      content: '确认师傅已按标准完成上门服务内容吗？',
      success(res) {
        if (res.confirm) {
          request.post('/fulfillment/confirm', { orderId: that.data.orderId, note: '老人/家属确认满意' }).then(() => {
            wx.showToast({ title: '服务确认完成', icon: 'success' });
            that.loadDetail(that.data.orderId);
          });
        }
      }
    });
  },

  goToReview() {
    wx.navigateTo({
      url: `/pages/order/confirm?orderId=${this.data.orderId}`
    });
  }
});
