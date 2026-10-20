const request = require('../../utils/request.js');
const app = getApp();

Page({
  data: {
    serviceId: null,
    service: null,
    elders: [],
    elderIndex: -1,
    selectedElder: null,
    startDate: '',
    endDate: '',
    selectedDate: '',
    selectedTime: '09:00',
    address: '',
    contactName: '',
    contactPhone: '',
    remark: '',
    submitting: false,
    isElderMode: false
  },

  onLoad(options) {
    if (options && options.serviceId) {
      this.setData({ serviceId: options.serviceId });
      this.loadService(options.serviceId);
    }
    this.initDates();
  },

  onShow() {
    this.setData({ isElderMode: app.globalData.isElderMode });
    this.loadElders();
  },

  initDates() {
    const now = new Date();
    const pad = n => (n < 10 ? '0' + n : n);
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    
    // 最大支持预约未来30天
    const maxDate = new Date();
    maxDate.setDate(now.getDate() + 30);
    const maxStr = `${maxDate.getFullYear()}-${pad(maxDate.getMonth() + 1)}-${pad(maxDate.getDate())}`;

    this.setData({
      startDate: todayStr,
      endDate: maxStr,
      selectedDate: todayStr
    });
  },

  loadService(id) {
    request.get(`/service-items/${id}`).then(data => {
      this.setData({ service: data });
    });
  },

  loadElders() {
    request.get('/elders/my-list').then(data => {
      const elders = data || [];
      this.setData({ elders });
      if (elders.length > 0 && !this.data.selectedElder) {
        this.selectElder(0);
      }
    });
  },

  onElderChange(e) {
    const index = parseInt(e.detail.value, 10);
    this.selectElder(index);
  },

  selectElder(index) {
    const elder = this.data.elders[index];
    if (elder) {
      this.setData({
        elderIndex: index,
        selectedElder: elder,
        address: elder.address || '',
        contactName: elder.emergencyContact || elder.name,
        contactPhone: elder.emergencyPhone || elder.phone
      });
    }
  },

  onDateChange(e) {
    this.setData({ selectedDate: e.detail.value });
  },

  onTimeChange(e) {
    this.setData({ selectedTime: e.detail.value });
  },

  onInputAddress(e) { this.setData({ address: e.detail.value }); },
  onInputContactName(e) { this.setData({ contactName: e.detail.value }); },
  onInputContactPhone(e) { this.setData({ contactPhone: e.detail.value }); },
  onInputRemark(e) { this.setData({ remark: e.detail.value }); },

  goToAddElder() {
    wx.navigateTo({
      url: '/pages/user/elder-form'
    });
  },

  submitOrder() {
    const { selectedElder, service, selectedDate, selectedTime, address, contactName, contactPhone, remark } = this.data;

    if (!selectedElder) {
      wx.showToast({ title: '请选择服务对象老人', icon: 'none' });
      return;
    }
    if (!selectedDate || !selectedTime) {
      wx.showToast({ title: '请选择预约上门时间', icon: 'none' });
      return;
    }
    if (!address.trim()) {
      wx.showToast({ title: '请填写详细服务地址', icon: 'none' });
      return;
    }
    if (!contactName.trim() || !contactPhone.trim()) {
      wx.showToast({ title: '请填写联系人和联系电话', icon: 'none' });
      return;
    }

    const plannedStartAt = `${selectedDate} ${selectedTime}:00`;

    // 防重幂等键
    const idempotencyKey = `REQ_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    this.setData({ submitting: true });

    request.post('/orders/create', {
      elderId: selectedElder.id,
      serviceItemId: service.id,
      plannedStartAt,
      address,
      contactName,
      contactPhone,
      remark,
      idempotencyKey
    }).then(order => {
      wx.showToast({ title: '预约成功，系统已派单', icon: 'success' });
      setTimeout(() => {
        wx.redirectTo({
          url: `/pages/order/detail?id=${order.id}`
        });
      }, 1000);
    }).catch(() => {
      this.setData({ submitting: false });
    });
  }
});
