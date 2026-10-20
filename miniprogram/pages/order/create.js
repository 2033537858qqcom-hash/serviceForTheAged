const navigation = require('../../utils/navigation.js');
const { lightTap } = require('../../utils/feedback.js');
const BOOKING_BEAT_MS = 420;
const request = require('../../utils/request.js');
const { getCachedService, loadService } = require('../../utils/service-catalog.js');
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
    submitPhase: '',
    idempotencyKey: '',
    isElderMode: false
  },

  onLoad(options) {
    if (options && options.serviceId) {
      this.setData({ serviceId: options.serviceId, service: getCachedService(options.serviceId) });
      this.loadService(options.serviceId);
    }
    this.initDates();
  },

  onShow() {
    const app = getAppSafe();
    const isElder = Boolean(app.globalData?.isElderMode);
    if (this.data.isElderMode !== isElder) this.setData({ isElderMode: isElder });
    if (!navigation.requireLogin(`/pages/order/create?serviceId=${this.data.serviceId || ''}`)) return;
    this.loadElders();
  },
  onUnload() { this._disposed = true; },

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
    const context = app.globalData.baseUrl;
    return loadService(id).then(data => {
      if (!this._disposed && app.globalData.baseUrl === context) this.setData({ service: data });
    }).catch(() => {});
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
    navigation.navigateTo({
      url: '/pages/user/elder-form'
    });
  },

  getIdempotencyKey() {
    if (!this.data.idempotencyKey) {
      const key = `REQ_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
      this.setData({ idempotencyKey: key });
      return key;
    }
    return this.data.idempotencyKey;
  },

  submitOrder() {
    if (this._createdOrderId) {
      navigation.redirectTo({ url: `/pages/order/detail?id=${this._createdOrderId}` });
      return;
    }
    if (this.data.submitting) {
      return;
    }

    const { selectedElder, service, selectedDate, selectedTime, address, contactName, contactPhone, remark } = this.data;

    if (!service) {
      wx.showToast({ title: '服务信息加载中，请稍后再试', icon: 'none' });
      return;
    }

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
    const idempotencyKey = this.getIdempotencyKey();

    lightTap();
    this.setData({ submitting: true });

    return request.post('/orders/create', {
      elderId: selectedElder.id,
      serviceItemId: service.id,
      plannedStartAt,
      address,
      contactName,
      contactPhone,
      remark,
      idempotencyKey
    }).then(order => {
      markOrdersChanged();
      this._createdOrderId = order.id;
      if (this._disposed) return;
      // A failed route can be retried without issuing another create request.
      let toastTitle = '预约提交成功';
      if (order.status === 'WAIT_ACCEPT') {
        toastTitle = '预约成功，系统已派单';
      } else if (order.status === 'WAIT_MANUAL') {
        toastTitle = '预约已提交，待社区人工派单';
      } else if (order.status === 'WAIT_DISPATCH') {
        toastTitle = '预约已提交，调度排队中';
      }
      this.setData({ submitPhase: 'done' });
      lightTap();
      return new Promise(resolve => {
        setTimeout(() => {
          if (!this._disposed) {
            wx.showToast({ title: toastTitle, icon: 'success' });
            navigation.redirectTo({
              url: `/pages/order/detail?id=${order.id}`,
              fail: () => { if (!this._disposed) this.setData({ submitting: false, submitPhase: '' }); }
            });
          }
          resolve();
        }, BOOKING_BEAT_MS);
      });
    }).catch(() => {
      if (!this._disposed) this.setData({ submitting: false, submitPhase: '' });
    });
  }
});
