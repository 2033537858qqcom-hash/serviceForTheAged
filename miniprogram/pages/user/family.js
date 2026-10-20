const request = require('../../utils/request.js');
const app = getApp();

Page({
  data: {
    allElders: [],
    selectedElderIndex: -1,
    targetElder: null,
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
    this.setData({ isElderMode: app.globalData.isElderMode });
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

  onInputRelation(e) { this.setData({ relation: e.detail.value }); },
  onInputProof(e) { this.setData({ proofMaterials: e.detail.value }); },

  submitApply() {
    const { targetElder, relation, proofMaterials } = this.data;
    if (!targetElder) {
      wx.showToast({ title: '请选择要绑定的老人', icon: 'none' });
      return;
    }
    if (!relation.trim()) {
      wx.showToast({ title: '请填写亲属关系', icon: 'none' });
      return;
    }

    request.post('/family-bindings/apply', {
      elderId: targetElder.id,
      relation,
      proofMaterials
    }).then(() => {
      wx.showToast({ title: '申请已提交，等待社区审核', icon: 'success' });
      this.setData({
        targetElder: null,
        selectedElderIndex: -1,
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
      confirmColor: '#ff4d4f',
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
