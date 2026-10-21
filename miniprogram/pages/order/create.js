const navigation = require('../../utils/navigation.js');
const { lightTap } = require('../../utils/feedback.js');
const BOOKING_BEAT_MS = 420;
const request = require('../../utils/request.js');
const { getCachedService, loadService } = require('../../utils/service-catalog.js');
const { markOrdersChanged, sessionKey } = require('../../utils/list-state.js');

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

function formatFriendlyDate(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const pad = n => (n < 10 ? '0' + n : n);
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const tomorrow = new Date(now.getTime() + 86400000);
  const tomorrowStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (dateStr === todayStr) {
    return `今天 ${month}月${day}日`;
  }
  if (dateStr === tomorrowStr) {
    return `明天 ${month}月${day}日`;
  }
  return `${month}月${day}日`;
}

Page({
  data: {
    serviceId: null,
    service: null,
    elders: [],
    eldersLoadError: false,
    elderIndex: -1,
    selectedElder: null,
    startDate: '',
    endDate: '',
    selectedDate: '',
    friendlyDateText: '',
    selectedTime: '09:00',
    address: '',
    latitude: null,
    longitude: null,
    contactName: '',
    contactPhone: '',
    remark: '',
    submitting: false,
    submitPhase: '',
    idempotencyKey: '',
    isElderMode: false,
    formErrors: {
      elder: '',
      time: '',
      address: '',
      contactName: '',
      contactPhone: ''
    }
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
    if (!navigation.requireRole(['RESIDENT'], `/pages/order/create?serviceId=${this.data.serviceId || ''}`)) return;
    return this.loadElders();
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

    const firstSlot = new Date(now.getTime() + 35 * 60000);
    firstSlot.setSeconds(0, 0);
    firstSlot.setMinutes(Math.ceil(firstSlot.getMinutes() / 5) * 5);
    if (firstSlot.getHours() >= 18) {
      firstSlot.setDate(firstSlot.getDate() + 1);
      firstSlot.setHours(8, 0, 0, 0);
    } else if (firstSlot.getHours() < 8) firstSlot.setHours(8, 0, 0, 0);

    const selectedDate = `${firstSlot.getFullYear()}-${pad(firstSlot.getMonth() + 1)}-${pad(firstSlot.getDate())}`;
    this.setData({
      startDate: todayStr,
      endDate: maxStr,
      selectedDate,
      friendlyDateText: formatFriendlyDate(selectedDate),
      selectedTime: `${pad(firstSlot.getHours())}:${pad(firstSlot.getMinutes())}`
    });
  },

  loadService(id) {
    const context = app.globalData.baseUrl;
    return loadService(id).then(data => {
      if (!this._disposed && app.globalData.baseUrl === context) this.setData({ service: data });
    }).catch(() => {});
  },

  loadElders() {
    const context = sessionKey(getAppSafe());
    if (this._eldersJob?.context === context) return this._eldersJob.task;
    if (this._eldersContext !== context) {
      this._eldersContext = context;
      this.setData({ elders: [], selectedElder: null, elderIndex: -1, address: '', latitude: null, longitude: null, contactName: '', contactPhone: '' });
    }
    const job = { context };
    this._eldersJob = job;
    const valid = () => !this._disposed && sessionKey(getAppSafe()) === context && this._eldersJob === job;
    this.setData({ eldersLoadError: false });
    const task = request.get('/elders/my-list').then(data => {
      if (!valid()) return;
      const elders = data || [];
      this.setData({ elders });
      const selected = this.data.selectedElder;
      if (selected && !elders.some(elder => String(elder.id) === String(selected.id))) {
        this.setData({ selectedElder: null, elderIndex: -1, address: '', latitude: null, longitude: null, contactName: '', contactPhone: '' });
      } else if (selected) {
        this.setData({ elderIndex: elders.findIndex(elder => String(elder.id) === String(selected.id)) });
      }
      if (elders.length > 0 && !this.data.selectedElder) {
        this.selectElder(0);
      }
    }).catch(() => {
      if (valid()) this.setData({ eldersLoadError: true });
    }).finally(() => {
      if (this._eldersJob === job) this._eldersJob = null;
    });
    job.task = task;
    return task;
  },

  onElderChange(e) {
    const index = parseInt(e.detail.value, 10);
    this.selectElder(index);
    this.setData({ 'formErrors.elder': '' });
  },

  selectElder(index) {
    const elder = this.data.elders[index];
    if (elder) {
      this.setData({
        elderIndex: index,
        selectedElder: elder,
        address: elder.address || '',
        latitude: elder.latitude ?? null,
        longitude: elder.longitude ?? null,
        contactName: elder.emergencyContact || elder.name || '',
        contactPhone: String(elder.emergencyPhone || elder.phone || ''),
        'formErrors.elder': '',
        'formErrors.address': '',
        'formErrors.contactName': '',
        'formErrors.contactPhone': ''
      });
    }
  },

  onChooseLocation() {
    wx.chooseLocation({
      latitude: this.data.latitude ? Number(this.data.latitude) : undefined,
      longitude: this.data.longitude ? Number(this.data.longitude) : undefined,
      success: (res) => {
        const fullAddress = res.name ? (res.address ? `${res.address} (${res.name})` : res.name) : res.address;
        this.setData({
          address: fullAddress || this.data.address,
          latitude: res.latitude,
          longitude: res.longitude,
          'formErrors.address': ''
        });
      },
      fail: (err) => {
        if (err && err.errMsg && !err.errMsg.includes('cancel')) {
          wx.showToast({ title: '打开地图选点失败', icon: 'none' });
        }
      }
    });
  },

  onDateChange(e) {
    const selectedDate = e.detail.value;
    this.setData({
      selectedDate,
      friendlyDateText: formatFriendlyDate(selectedDate),
      'formErrors.time': ''
    });
  },

  onTimeChange(e) {
    this.setData({
      selectedTime: e.detail.value,
      'formErrors.time': ''
    });
  },

  onInputAddress(e) {
    this.setData({
      address: e.detail.value,
      latitude: null,
      longitude: null,
      'formErrors.address': ''
    });
  },

  onInputContactName(e) {
    this.setData({
      contactName: e.detail.value,
      'formErrors.contactName': ''
    });
  },

  onInputContactPhone(e) {
    this.setData({
      contactPhone: e.detail.value,
      'formErrors.contactPhone': ''
    });
  },

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

    const { selectedElder, service, selectedDate, selectedTime, address, latitude, longitude, contactName, contactPhone, remark } = this.data;

    if (!service) {
      wx.showToast({ title: '服务信息加载中，请稍后再试', icon: 'none' });
      return;
    }

    const formErrors = { elder: '', time: '', address: '', contactName: '', contactPhone: '' };
    let hasError = false;

    if (!selectedElder) {
      formErrors.elder = '请选择接受服务的老人';
      hasError = true;
    }
    if (!selectedDate || !selectedTime) {
      formErrors.time = '请选择预约上门时间';
      hasError = true;
    } else {
      const start = new Date(`${selectedDate.replace(/-/g, '/')} ${selectedTime}:00`);
      if (!Number.isFinite(start.getTime()) || start.getTime() < Date.now() + 30 * 60000) {
        formErrors.time = '预约时间需至少提前30分钟';
        hasError = true;
      }
    }
    if (!address || !address.trim()) {
      formErrors.address = '请填写详细上门服务地址';
      hasError = true;
    }
    if (!contactName || !contactName.trim()) {
      formErrors.contactName = '请填写联系人姓名';
      hasError = true;
    }
    if (!contactPhone || !contactPhone.trim()) {
      formErrors.contactPhone = '请填写联系电话';
      hasError = true;
    }

    if (hasError) {
      this.setData({ formErrors });
      const firstError = formErrors.elder || formErrors.time || formErrors.address || formErrors.contactName || formErrors.contactPhone;
      wx.showToast({ title: firstError, icon: 'none' });
      return;
    }

    const plannedStartAt = `${selectedDate} ${selectedTime}:00`;
    const idempotencyKey = this.getIdempotencyKey();

    lightTap();
    this.setData({ submitting: true });
    const context = sessionKey(getAppSafe());

    return request.post('/orders/create', {
      elderId: selectedElder.id,
      serviceItemId: service.id,
      plannedStartAt,
      address,
      latitude: latitude != null ? latitude : null,
      longitude: longitude != null ? longitude : null,
      coordinateType: 'GCJ02',
      contactName,
      contactPhone,
      remark,
      idempotencyKey
    }).then(order => {
      if (sessionKey(getAppSafe()) !== context) return;
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
