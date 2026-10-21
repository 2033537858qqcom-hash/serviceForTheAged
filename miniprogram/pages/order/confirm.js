const navigation = require('../../utils/navigation.js');
const request = require('../../utils/request.js');
const { lightTap } = require('../../utils/feedback.js');
const { markOrdersChanged } = require('../../utils/list-state.js');

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
    rating: 5,
    content: '',
    submitting: false,
    isElderMode: false,
    scoreDescMap: {
      1: '非常不满意，亟需改进',
      2: '较不满意，存在瑕疵',
      3: '一般，基本合格',
      4: '满意，服务较好',
      5: '非常满意，十分专业准时'
    }
  },

  onLoad(options) {
    if (options && options.orderId) {
      this.setData({ orderId: options.orderId });
    }
  },

  onShow() {
    const app = getAppSafe();
    const isElder = Boolean(app.globalData?.isElderMode);
    if (this.data.isElderMode !== isElder) this.setData({ isElderMode: isElder });
    navigation.requireLogin(`/pages/order/confirm?orderId=${this.data.orderId || ''}`);
  },
  onUnload() { this._disposed = true; },

  setRating(e) {
    const rating = e.currentTarget.dataset.rating;
    try { lightTap(); } catch (_) {}
    this.setData({ rating });
  },

  onInputContent(e) {
    this.setData({ content: e.detail.value });
  },

  submitReview() {
    if (this.data.submitting) return;
    if (this._submitted) { this.returnToOrder(); return; }
    const { orderId, rating, content } = this.data;
    if (!orderId) {
      wx.showToast({ title: '缺少订单信息，请从订单详情进入', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    return request.post('/fulfillment/review', {
      orderId,
      rating,
      content
    }).then(() => {
      markOrdersChanged();
      this._submitted = true;
      if (this._disposed) return;
      this.setData({ submitSuccess: true });
      try { lightTap(); } catch (_) {}
      wx.showToast({ title: '评价成功，感谢反馈', icon: 'success' });
      this.returnToOrder();
    }).catch(() => { if (!this._disposed) this.setData({ submitting: false }); });
  },
  returnToOrder() {
    navigation.navigateBack({ fallbackUrl: this.data.orderId ? `/pages/order/detail?id=${this.data.orderId}` : '/pages/order/list', fail: () => { if (!this._disposed) this.setData({ submitting: false }); } });
  }
});
