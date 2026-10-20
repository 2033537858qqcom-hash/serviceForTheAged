const request = require('../../utils/request.js');
const app = getApp();

Page({
  data: {
    name: '',
    gender: 'MALE',
    age: '',
    address: '阳光花园社区',
    emergencyContact: '',
    emergencyPhone: '',
    healthNote: '',
    isElderMode: false
  },

  onShow() {
    this.setData({ isElderMode: app.globalData.isElderMode });
  },

  onInputName(e) { this.setData({ name: e.detail.value }); },
  onGenderChange(e) { this.setData({ gender: e.detail.value === '1' ? 'FEMALE' : 'MALE' }); },
  onInputAge(e) { this.setData({ age: e.detail.value }); },
  onInputAddress(e) { this.setData({ address: e.detail.value }); },
  onInputContact(e) { this.setData({ emergencyContact: e.detail.value }); },
  onInputPhone(e) { this.setData({ emergencyPhone: e.detail.value }); },
  onInputHealth(e) { this.setData({ healthNote: e.detail.value }); },

  saveElder() {
    const { name, gender, age, address, emergencyContact, emergencyPhone, healthNote } = this.data;
    if (!name.trim()) {
      wx.showToast({ title: '请填写老人姓名', icon: 'none' });
      return;
    }
    if (!address.trim()) {
      wx.showToast({ title: '请填写居住地址', icon: 'none' });
      return;
    }

    request.post('/elders/save', {
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
      wx.showToast({ title: '档案保存成功', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1000);
    });
  }
});
