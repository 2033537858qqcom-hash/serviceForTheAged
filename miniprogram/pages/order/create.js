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
    this.setData({
      startDate: todayStr,
      endDate: maxStr,
      selectedDate: `${firstSlot.getFullYear()}-${pad(firstSlot.getMonth() + 1)}-${pad(firstSlot.getDate())}`,
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
        contactPhone: String(elder.emergencyPhone || elder.phone || '')
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

  onDateChange(e) {
    this.setData({ selectedDate: e.detail.value });
  },

  onTimeChange(e) {
    this.setData({ selectedTime: e.detail.value });
  },

  onInputAddress(e) { this.setData({ address: e.detail.value, latitude: null, longitude: null }); },
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

    const { selectedElder, service, selectedDate, selectedTime, address, latitude, longitude, contactName, contactPhone, remark } = this.data;

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
    const start = new Date(`${selectedDate.replace(/-/g, '/')} ${selectedTime}:00`);
    if (!Number.isFinite(start.getTime()) || start.getTime() < Date.now() + 30 * 60000) {
      wx.showToast({ title: '请至少提前30分钟预约', icon: 'none' });
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
