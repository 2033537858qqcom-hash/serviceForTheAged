const navigation = require('../../utils/navigation.js');
const request = require('../../utils/request.js');
const { sessionKey } = require('../../utils/list-state.js');

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
    loading: false,
    searching: false,
    applying: false,
    loadError: false,
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
    if (!navigation.requireRole(['RESIDENT'], '/pages/user/family')) return;
    return this.loadData();
  },

  onUnload() { this._disposed = true; },

  loadData() {
    const context = sessionKey(getAppSafe());
    if (this._dataJob?.context === context) return this._dataJob.task;
    if (this._dataContext !== context) {
      this._dataContext = context;
      this.setData({ allElders: [], bindings: [], targetElder: null, selectedElderIndex: -1, searchPhone: '', relation: '', proofMaterials: '', applying: false, searching: false });
    }
    const job = { context };
    this._dataJob = job;
    const valid = () => !this._disposed && sessionKey(getAppSafe()) === context && this._dataJob === job;
    this.setData({ loading: true, loadError: false });
    const task = Promise.all([request.get('/elders/my-list'), request.get('/family-bindings/my-bindings')]).then(([elders, bindings]) => {
      if (valid()) this.setData({ allElders: elders || [], bindings: bindings || [] });
    }).catch(() => {
      if (valid()) this.setData({ loadError: true });
    }).finally(() => {
      if (valid()) this.setData({ loading: false });
      if (this._dataJob === job) this._dataJob = null;
    });
    job.task = task;
    return task;
  },

  onElderChange(e) {
    this._searchVersion = (this._searchVersion || 0) + 1;
    const idx = parseInt(e.detail.value, 10);
    this.setData({
      selectedElderIndex: idx,
      targetElder: this.data.allElders[idx] || null,
      searchPhone: '',
      searching: false
    });
  },

  onInputSearchPhone(e) {
    this._searchVersion = (this._searchVersion || 0) + 1;
    this.setData({ searchPhone: e.detail.value, targetElder: null, selectedElderIndex: -1, searching: false });
  },

  searchElder() {
    if (this.data.searching) return Promise.resolve();
    const { searchPhone } = this.data;
    if (!searchPhone || !searchPhone.trim()) {
      wx.showToast({ title: '请输入老人联系电话', icon: 'none' });
      return;
    }
    const context = sessionKey(getAppSafe());
    const version = this._searchVersion = (this._searchVersion || 0) + 1;
    const valid = () => !this._disposed && sessionKey(getAppSafe()) === context && this._searchVersion === version;
    this.setData({ searching: true });
    return request.get(`/family-bindings/search-elder?phone=${encodeURIComponent(searchPhone.trim())}`).then(elder => {
      if (!valid()) return;
      if (!elder) {
        this.setData({ targetElder: null });
        wx.showToast({ title: '未找到对应老人档案', icon: 'none' });
        return;
      }
      this.setData({
        targetElder: elder,
        selectedElderIndex: -1
      });
      wx.showToast({ title: `已找到 ${elder.name}`, icon: 'success' });
    }).catch(() => {}).finally(() => { if (valid()) this.setData({ searching: false }); });
  },

  onInputRelation(e) { this.setData({ relation: e.detail.value }); },
  onInputProof(e) { this.setData({ proofMaterials: e.detail.value }); },

  submitApply() {
    if (this.data.applying) return Promise.resolve();
    const { targetElder, searchPhone, relation, proofMaterials } = this.data;
    if (!targetElder && !searchPhone) {
      wx.showToast({ title: '请选择或搜索要绑定的老人', icon: 'none' });
      return;
    }
    if (!relation.trim()) {
      wx.showToast({ title: '请填写亲属关系', icon: 'none' });
      return;
    }

    const context = sessionKey(getAppSafe());
    this.setData({ applying: true });
    return request.post('/family-bindings/apply', {
      elderId: targetElder ? targetElder.id : null,
      elderPhone: searchPhone ? searchPhone.trim() : null,
      relation,
      proofMaterials
    }).then(() => {
      if (this._disposed || sessionKey(getAppSafe()) !== context) return;
      wx.showToast({ title: '申请已提交，等待社区审核', icon: 'success' });
      this.setData({
        targetElder: null,
        selectedElderIndex: -1,
        searchPhone: '',
        relation: '',
        proofMaterials: ''
      });
      return this.loadData();
    }).catch(() => {}).finally(() => {
      if (!this._disposed && sessionKey(getAppSafe()) === context) this.setData({ applying: false });
    });
  },

  revokeBinding(e) {
    if (this._revoking || this._disposed) return;
    const id = e.currentTarget.dataset.id;
    const context = sessionKey(getAppSafe());
    const that = this;
    wx.showModal({
      title: '撤销授权',
      content: '确定撤销与该老人的绑定代约关系吗？',
      confirmColor: '#b83a3a',
      success(res) {
        if (res.confirm && !that._revoking && !that._disposed && sessionKey(getAppSafe()) === context) {
          that._revoking = true;
          request.post(`/family-bindings/${id}/revoke`).then(() => {
            if (that._disposed || sessionKey(getAppSafe()) !== context) return;
            wx.showToast({ title: '已撤销绑定', icon: 'success' });
            return that.loadData();
          }).catch(() => {}).finally(() => { that._revoking = false; });
        }
      }
    });
  }
});
