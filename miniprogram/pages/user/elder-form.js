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
    id: null,
    name: '',
    gender: 'MALE',
    age: '',
    address: '阳光花园社区',
    latitude: null,
    longitude: null,
    emergencyContact: '',
    emergencyPhone: '',
    healthNote: '',
    careLevel: 'NORMAL',
    submitting: false,
    isElderMode: false
  },

  onLoad(options) {
    if (options && options.id) {
      this.setData({ id: options.id });
      if (typeof wx !== 'undefined' && wx.setNavigationBarTitle) {
        wx.setNavigationBarTitle({ title: '编辑老人档案' });
      }
      request.get(`/elders/${options.id}`).then(data => {
        if (this._disposed || !data) return;
        this.setData({
          name: data.name || '',
          gender: data.gender || 'MALE',
          age: data.age != null ? String(data.age) : '',
          address: data.address || '',
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          emergencyContact: data.emergencyContact || '',
          emergencyPhone: data.emergencyPhone || '',
          healthNote: data.healthNote || '',
          careLevel: data.careLevel || 'NORMAL'
        });
      }).catch(() => {});
    }
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
  onInputAddress(e) { this.setData({ address: e.detail.value, latitude: null, longitude: null }); },
  onInputContact(e) { this.setData({ emergencyContact: e.detail.value }); },
  onInputPhone(e) { this.setData({ emergencyPhone: e.detail.value }); },
  onInputHealth(e) { this.setData({ healthNote: e.detail.value }); },

  onChooseLocation() {
    wx.chooseLocation({
      latitude: this.data.latitude ? Number(this.data.latitude) : undefined,
      longitude: this.data.longitude ? Number(this.data.longitude) : undefined,
      success: (res) => {
        const fullAddress = res.name ? (res.address ? `${res.address} (${res.name})` : res.name) : res.address;
        this.setData({
          address: fullAddress || this.data.address,
          latitude: res.latitude,
          longitude: res.longitude
        });
      },
      fail: (err) => {
        if (err && err.errMsg && !err.errMsg.includes('cancel')) {
          wx.showToast({ title: '打开地图选点失败', icon: 'none' });
        }
      }
    });
  },

  saveElder() {
    if (this.data.submitting) return;
    if (this._saved) { this.returnToPrevious(); return; }
    const { id, name, gender, age, address, latitude, longitude, emergencyContact, emergencyPhone, healthNote, careLevel } = this.data;
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
      id: id || undefined,
      name,
      gender,
      age: age ? parseInt(age, 10) : null,
      address,
      latitude: latitude != null ? latitude : null,
      longitude: longitude != null ? longitude : null,
      community: '阳光花园社区',
      emergencyContact,
      emergencyPhone,
      healthNote,
      careLevel: careLevel || 'NORMAL'
    }).then(() => {
      this._saved = true;
      if (this._disposed) return;
      wx.showToast({ title: '档案保存成功', icon: 'success' });
      this.returnToPrevious();
    }).catch(() => { if (!this._disposed) this.setData({ submitting: false }); });
  },
  returnToPrevious() {
    navigation.navigateBack({ fallbackUrl: '/pages/user/profile', fail: () => { if (!this._disposed) this.setData({ submitting: false }); } });
  }
});
