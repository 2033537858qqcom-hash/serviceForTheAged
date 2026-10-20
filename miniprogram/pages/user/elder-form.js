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
    name: '',
    gender: 'MALE',
    age: '',
    address: '阳光花园社区',
    emergencyContact: '',
    emergencyPhone: '',
    healthNote: '',
    submitting: false,
    isElderMode: false
  },

  onShow() {
    const app = getAppSafe();
    const isElder = Boolean(app.globalData?.isElderMode);
    if (this.data.isElderMode !== isElder) this.setData({ isElderMode: isElder });
    navigation.requireLogin('/pages/user/elder-form');
  },
  onUnload() { this._disposed = true; },

  onInputName(e) { this.setData({ name: e.detail.value }); },
  onGenderChange(e) { this.setData({ gender: e.detail.value === '1' ? 'FEMALE' : 'MALE' }); },
  onInputAge(e) { this.setData({ age: e.detail.value }); },
  onInputAddress(e) { this.setData({ address: e.detail.value }); },
  onInputContact(e) { this.setData({ emergencyContact: e.detail.value }); },
  onInputPhone(e) { this.setData({ emergencyPhone: e.detail.value }); },
  onInputHealth(e) { this.setData({ healthNote: e.detail.value }); },

  saveElder() {
    if (this.data.submitting) return;
    if (this._saved) { this.returnToPrevious(); return; }
    const { name, gender, age, address, emergencyContact, emergencyPhone, healthNote } = this.data;
    if (!name.trim()) {
      wx.showToast({ title: '请填写老人姓名', icon: 'none' });
      return;
    }
    if (!address.trim()) {
      wx.showToast({ title: '请填写居住地址', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    return request.post('/elders/save', {
      name,
      gender,
      age: age ? parseInt(age, 10) : null,
      address,
      community: '阳光花园社区',
      emergencyContact,
      emergencyPhone,
      healthNote,
      careLevel: 'NORMAL'
    }).then(() => {
      this._saved = true;
      if (this._disposed) return;
      wx.showToast({ title: '档案保存成功', icon: 'success' });
      this.returnToPrevious();
    }).catch(() => { if (!this._disposed) this.setData({ submitting: false }); });
  },
  returnToPrevious() {
    navigation.navigateBack({ fail: () => { if (!this._disposed) this.setData({ submitting: false }); } });
  }
});
