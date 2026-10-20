const navigation = require('../../utils/navigation.js');
const request = require('../../utils/request.js');
const { lightTap } = require('../../utils/feedback.js');
const { markOrdersChanged, sessionKey } = require('../../utils/list-state.js');

function getAppSafe() {
  try {
    return getApp() || { globalData: {} };
  } catch (_) {
    return { globalData: {} };
  }
}

const app = new Proxy({}, {
  get(_, prop) {
    const instance = getAppSafe();
    const val = instance[prop];
    if (typeof val === 'function') return val.bind(instance);
    return val;
  },
  set(_, prop, val) {
    const instance = getAppSafe();
    instance[prop] = val;
    return true;
  }
});

Page({
  data: {
    orderId: null,
    orderVO: null,
    loading: true,
    loadError: false,
    canCancel: false,
    isElderMode: false,
    cancelSheet: false,
    confirmSheet: false,
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
      'WAIT_DISPATCH': '系统正在为您匹配符合技能与时间要求的服务人员',
      'WAIT_ACCEPT': '已向服务人员发送派单通知，等待确认接单',
      'WAIT_VISIT': '服务人员已接单，正在准备并按时上门履约',
      'IN_SERVICE': '服务人员已到达现场，正在提供照护服务',
      'WAIT_CONFIRM': '服务人员已完成服务并提交记录，请您核实确认',
      'COMPLETED': '服务已顺利完成，感谢您对社区养老工作的信任',
      'WAIT_MANUAL': '暂时暂无匹配人员，社区管理员正在人工协调处置',
      'CANCELLED': '该订单已按规则取消，排班预留已释放'
    }
  },

  onLoad(options) {
    if (options && options.id) {
      this.setData({ orderId: options.id });
    } else {
      this.setData({ loading: false, loadError: true });
    }
  },

  onShow() {
    const app = getAppSafe();
    const isElder = Boolean(app.globalData?.isElderMode);
    if (this.data.isElderMode !== isElder) {
      this.setData({ isElderMode: isElder });
    }
    if (!navigation.requireLogin(`/pages/order/detail?id=${this.data.orderId || ''}`)) return;
    if (this.data.orderId) {
      return this.loadDetail(this.data.orderId);
    }
  },

  onUnload() {
    this._disposed = true;
  },

  onPullDownRefresh() {
    return this.loadDetail(this.data.orderId, true).finally(() => wx.stopPullDownRefresh());
  },

  retryDetail() {
    return this.loadDetail(this.data.orderId, true);
  },

  loadDetail(id, force = false) {
    if (!id) return Promise.resolve();
    const app = getAppSafe();
    const context = sessionKey(app);
    if (this._context !== context) {
      this._context = context;
      this._pending = null;
      this._updatedAt = 0;
      this._refreshAfter = false;
      if (this.data.orderVO) this.setData({ orderVO: null, canCancel: false });
    }
    const version = app.globalData?.ordersVersion || 0;
    if (this._pending) {
      if (force || this._requestVersion !== version) this._refreshAfter = true;
      return this._pending;
    }
    if (!force && this._version === version && this._updatedAt && Date.now() - this._updatedAt < 15000) {
      return Promise.resolve();
    }
    this._requestVersion = version;
    this.setData({ loading: true, loadError: false });
    const valid = () => !this._disposed && this._context === context && sessionKey(getAppSafe()) === context;
    const task = request.get(`/orders/${id}`).then(data => {
      if (!valid()) return;
      const curApp = getAppSafe();
      if (version !== (curApp.globalData?.ordersVersion || 0)) {
        this._refreshAfter = true;
        return;
      }
      const canCancel = ['WAIT_DISPATCH', 'WAIT_ACCEPT', 'WAIT_VISIT', 'WAIT_MANUAL'].includes(data.order.status);
      this.setData({ orderVO: data, canCancel });
      this._version = version;
      this._updatedAt = Date.now();
    }).catch(err => {
      console.warn('[order/detail loadDetail error]', err);
      if (valid()) this.setData({ loadError: true });
    }).finally(() => {
      if (!valid() || this._pending !== task) return;
      this._pending = null;
      this.setData({ loading: false });
      if (this._refreshAfter) {
        this._refreshAfter = false;
        return this.loadDetail(id, true);
      }
    });
    this._pending = task;
    return task;
  },

  callStaff() {
    const staffPhone = this.data.orderVO?.currentStaff?.user?.phone;
    if (staffPhone) {
      wx.makePhoneCall({ phoneNumber: staffPhone });
    }
  },

  cancelOrder() {
    this.setData({ cancelSheet: true });
  },

  closeCancelSheet() {
    this.setData({ cancelSheet: false });
  },

  submitCancel() {
    if (this._cancelling) return Promise.resolve();
    this._cancelling = true;
    this.setData({ cancelSheet: false });
    return request.post(`/orders/${this.data.orderId}/cancel`).then(() => {
      markOrdersChanged();
      wx.showToast({ title: '订单已取消', icon: 'success' });
      return this.loadDetail(this.data.orderId, true);
    }).finally(() => { this._cancelling = false; });
  },

  confirmOrder() {
    this.setData({ confirmSheet: true });
  },

  closeConfirmSheet() {
    this.setData({ confirmSheet: false });
  },

  submitConfirm() {
    if (this._confirming) return Promise.resolve();
    this._confirming = true;
    lightTap();
    this.setData({ confirmSheet: false });
    return request.post('/fulfillment/confirm', { orderId: this.data.orderId, note: '老人/家属确认满意' }).then(() => {
      markOrdersChanged();
      wx.showToast({ title: '服务确认完成', icon: 'success' });
      return this.loadDetail(this.data.orderId, true);
    }).finally(() => { this._confirming = false; });
  },

  goToReview() {
    navigation.navigateTo({
      url: `/pages/order/confirm?orderId=${this.data.orderId}`
    });
  }
});
