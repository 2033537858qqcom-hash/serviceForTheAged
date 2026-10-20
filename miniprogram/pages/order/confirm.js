const request = require('../../utils/request.js');
const app = getApp();

Page({
  data: {
    orderId: null,
    rating: 5,
    content: '',
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
    this.setData({ isElderMode: app.globalData.isElderMode });
  },

  setRating(e) {
    const rating = e.currentTarget.dataset.rating;
    this.setData({ rating });
  },

  onInputContent(e) {
    this.setData({ content: e.detail.value });
  },

  submitReview() {
    const { orderId, rating, content } = this.data;
    request.post('/fulfillment/review', {
      orderId,
      rating,
      content
    }).then(() => {
      wx.showToast({ title: '评价成功，感谢反馈', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1000);
    });
  }
});
