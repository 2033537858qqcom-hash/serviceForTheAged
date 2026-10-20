const navigation = require('../../utils/navigation.js');
const request = require('../../utils/request.js');

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
    allElders: [],
    selectedElderIndex: -1,
    targetElder: null,
    searchPhone: '',
    relation: '',
    proofMaterials: '',
    bindings: [],
    isElderMode: false,
    statusTextMap: {
      'PENDING': '待审核',
      'APPROVED': '已授权',
      'REJECTED': '已驳回',
      'REVOKED': '已撤销'
    },
    statusTagMap: {
      'PENDING': 'tag-warning',
      'APPROVED': 'tag-success',
      'REJECTED': 'tag-danger',
      'REVOKED': 'tag-info'
    }
  },

  onShow() {
    const app = getAppSafe();
    const isElder = Boolean(app.globalData?.isElderMode);
    if (this.data.isElderMode !== isElder) this.setData({ isElderMode: isElder });
    if (!navigation.requireLogin('/pages/user/family')) return;
    this.loadData();
  },

  loadData() {
    request.get('/elders/my-list').then(elders => {
      this.setData({ allElders: elders || [] });
    });
    request.get('/family-bindings/my-bindings').then(list => {
      this.setData({ bindings: list || [] });
    });
  },

  onElderChange(e) {
    const idx = parseInt(e.detail.value, 10);
    this.setData({
      selectedElderIndex: idx,
      targetElder: this.data.allElders[idx]
    });
  },

  onInputSearchPhone(e) {
    this.setData({ searchPhone: e.detail.value });
  },

  searchElder() {
    const { searchPhone } = this.data;
    if (!searchPhone || !searchPhone.trim()) {
      wx.showToast({ title: '请输入老人联系电话', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '正在查询...' });
    request.get(`/family-bindings/search-elder?phone=${encodeURIComponent(searchPhone.trim())}`).then(elder => {
      wx.hideLoading();
      this.setData({
        targetElder: elder,
        selectedElderIndex: -1
      });
      wx.showToast({ title: `已找到 ${elder.name}`, icon: 'success' });
    }).catch(() => {
      wx.hideLoading();
    });
  },

  onInputRelation(e) { this.setData({ relation: e.detail.value }); },
  onInputProof(e) { this.setData({ proofMaterials: e.detail.value }); },

  submitApply() {
    const { targetElder, searchPhone, relation, proofMaterials } = this.data;
    if (!targetElder && !searchPhone) {
      wx.showToast({ title: '请选择或搜索要绑定的老人', icon: 'none' });
      return;
    }
    if (!relation.trim()) {
      wx.showToast({ title: '请填写亲属关系', icon: 'none' });
      return;
    }

    request.post('/family-bindings/apply', {
      elderId: targetElder ? targetElder.id : null,
      elderPhone: searchPhone ? searchPhone.trim() : null,
      relation,
      proofMaterials
    }).then(() => {
      wx.showToast({ title: '申请已提交，等待社区审核', icon: 'success' });
      this.setData({
        targetElder: null,
        selectedElderIndex: -1,
        searchPhone: '',
        relation: '',
        proofMaterials: ''
      });
      this.loadData();
    });
  },

  revokeBinding(e) {
    const id = e.currentTarget.dataset.id;
    const that = this;
    wx.showModal({
      title: '撤销授权',
      content: '确定撤销与该老人的绑定代约关系吗？',
      confirmColor: '#b83a3a',
      success(res) {
        if (res.confirm) {
          request.post(`/family-bindings/${id}/revoke`).then(() => {
            wx.showToast({ title: '已撤销绑定', icon: 'success' });
            that.loadData();
          });
        }
      }
    });
  }
});
