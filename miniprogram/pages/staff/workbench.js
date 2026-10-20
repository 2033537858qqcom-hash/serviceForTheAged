const navigation = require('../../utils/navigation.js');
const request = require('../../utils/request.js');
const { taskCard, sessionKey, markOrdersChanged } = require('../../utils/list-state.js');

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

const TASK_TABS = [
  { key: '', label: '全部安排' },
  { key: 'WAIT_VISIT', label: '待上门' },
  { key: 'IN_SERVICE', label: '服务中' },
  { key: 'WAIT_CONFIRM,COMPLETED', label: '已完工' }
];

Page({
  data: {
    staffProfile: null,
    pendingAttempt: null,
    filteredTasks: [],
    taskTabs: TASK_TABS,
    currentTaskTabIndex: 0,
    showRecordModal: false,
    currentOrderId: null,
    recordSummary: '',
    actionLoading: false,
    loadError: false,
    isElderMode: false,
    statusTextMap: {
      'WAIT_VISIT': '待上门',
      'IN_SERVICE': '服务中',
      'WAIT_CONFIRM': '待确认',
      'COMPLETED': '已完成'
    },
    statusTagMap: {
      'WAIT_VISIT': 'tag-warning',
      'IN_SERVICE': 'tag-info',
      'WAIT_CONFIRM': 'tag-warning',
      'COMPLETED': 'tag-success'
    }
  },

  onShow() {
    this._hidden = false;
    const app = getAppSafe();
    const context = sessionKey(app);
    if (this._context !== context) {
      this._context = context; this._tasks = []; this._loadedAt = 0;
      this._staffPromise = null; this._tasksPromise = null;
      this.setData({ staffProfile: null, pendingAttempt: null, filteredTasks: [] });
    }
    const isElder = Boolean(app.globalData?.isElderMode);
    if (this.data.isElderMode !== isElder) this.setData({ isElderMode: isElder });
    if (!navigation.requireLogin('/pages/staff/workbench')) {
      return Promise.resolve();
    }
    return this.loadStaffData();
  },
  onHide() { this._hidden = true; },
  onUnload() { this._disposed = true; },
  onPullDownRefresh() { return this.loadStaffData(true).finally(() => wx.stopPullDownRefresh()); },
  changeTaskTab(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (index === this.data.currentTaskTabIndex || !TASK_TABS[index]) return;
    this.filterTasks(index);
  },
  filterTasks(index) {
    const keys = TASK_TABS[index].key.split(',');
    const tasks = this._tasks || [];
    const filteredTasks = TASK_TABS[index].key ? tasks.filter(item => keys.includes(item.order.status)) : tasks;
    this.setData({ currentTaskTabIndex: index, filteredTasks });
  },
  loadStaffData(force = false) {
    if (this._staffPromise) return this._staffPromise;
    const version = app.globalData.ordersVersion || 0;
    if (!force && this._loadedVersion === version && this._loadedAt && Date.now() - this._loadedAt < 15000) return Promise.resolve();
    const context = sessionKey(app);
    this.setData({ loadError: false });
    const profileTask = request.get('/staff/my-profile').then(profile => {
      if (this._disposed || sessionKey(app) !== context) return;
      this.setData({ staffProfile: { user: { realName: profile.user.realName }, profile: {
        id: profile.profile.id, priorRating: profile.profile.priorRating,
        totalOrders: profile.profile.totalOrders, currentStatus: profile.profile.currentStatus,
        auditStatus: profile.profile.auditStatus
      } } });
    });
    // Independent reads run together rather than waiting for the profile response.
    const task = Promise.all([profileTask, this.loadTasks()]).then(() => {
      if (sessionKey(app) === context) { this._loadedAt = Date.now(); this._loadedVersion = version; }
    }).catch(() => {
      if (!this._disposed && sessionKey(app) === context) this.setData({ loadError: true });
    }).finally(() => { if (this._staffPromise === task) this._staffPromise = null; });
    this._staffPromise = task;
    return task;
  },
  loadTasks() {
    if (this._tasksPromise) return this._tasksPromise;
    const context = sessionKey(app);
    const task = request.get('/orders/page', { pageNum: 1, pageSize: 20 }).then(data => {
      if (this._disposed || sessionKey(app) !== context) return;
      const records = (data?.records || []).map(taskCard);
      const pending = records.find(item => item.order.status === 'WAIT_ACCEPT' && item.currentDispatch?.status === 'PENDING');
      this._tasks = records.filter(item => ['WAIT_VISIT', 'IN_SERVICE', 'WAIT_CONFIRM', 'COMPLETED'].includes(item.order.status));
      this.setData({ pendingAttempt: pending ? { attempt: pending.currentDispatch, order: pending.order, elder: pending.elder } : null });
      this.filterTasks(this.data.currentTaskTabIndex);
    }).finally(() => { if (this._tasksPromise === task) this._tasksPromise = null; });
    this._tasksPromise = task;
    return task;
  },
  onDispatchExpired() {
    // Query once after the current load settles; the child emits once per deadline.
    return Promise.resolve(this._tasksPromise).catch(() => {}).then(() => {
      if (!this._hidden && !this._disposed) return this.loadTasks();
    }).catch(() => { if (!this._disposed) this.setData({ loadError: true }); });
  },
  performAction(url, body, message, changesOrders = true) {
    if (this.data.actionLoading) return Promise.resolve();
    this.setData({ actionLoading: true });
    return request.post(url, body).then(() => {
      if (changesOrders) markOrdersChanged();
      if (this._disposed) return;
      wx.showToast({ title: message, icon: 'success' });
      this.closeRecordModal();
      // A read started before the mutation must finish before the fresh read.
      return Promise.all([this._staffPromise, this._tasksPromise].map(pending => Promise.resolve(pending).catch(() => {})))
        .then(() => { if (!this._disposed) return this.loadStaffData(true); });
    }).catch(() => {}).finally(() => {
      if (!this._disposed) this.setData({ actionLoading: false });
    });
  },

  changeStatus(e) {
    const val = e.detail.value;
    const newStatus = val === '1' ? 'RESTING' : 'AVAILABLE';
    const staffId = this.data.staffProfile.profile.id;
    return this.performAction(`/staff/${staffId}/status?status=${newStatus}`, undefined, '工作状态已更新', false);
  },

  acceptDispatch(e) {
    const dispatchId = e.currentTarget.dataset.id;
    return this.performAction(`/dispatch/accept/${dispatchId}`, undefined, '接单成功，请按时上门');
  },

  rejectDispatch(e) {
    const dispatchId = e.currentTarget.dataset.id;
    const that = this;
    wx.showModal({
      title: '拒绝接单',
      content: '确认无法接单吗？系统将自动释放并重派其他人员。',
      confirmColor: '#b83a3a',
      success(res) {
        if (res.confirm) {
          that.performAction('/dispatch/reject', { dispatchId, reason: '人员当前工作安排冲突' }, '已拒单并释放预留');
        }
      }
    });
  },

  startService(e) {
    const orderId = e.currentTarget.dataset.id;
    return this.performAction(`/fulfillment/start/${orderId}`, undefined, '已签到，开始服务');
  },

  openSubmitRecordModal(e) {
    const orderId = e.currentTarget.dataset.id;
    this._recordSummary = '';
    this.setData({
      showRecordModal: true,
      currentOrderId: orderId,
      recordSummary: ''
    });
  },

  closeRecordModal() {
    this.setData({ showRecordModal: false });
  },

  onInputSummary(e) {
    this._recordSummary = e.detail.value;
  },

  submitRecord() {
    const { currentOrderId } = this.data;
    const recordSummary = this._recordSummary || this.data.recordSummary;
    if (!recordSummary.trim()) {
      wx.showToast({ title: '请填写服务情况说明', icon: 'none' });
      return;
    }

    const pad = n => (n < 10 ? '0' + n : n);
    const now = new Date();
    const formatTime = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    return this.performAction('/fulfillment/submit-record', {
      orderId: currentOrderId,
      actualEndAt: formatTime(now),
      serviceSummary: recordSummary
    }, '服务记录已提交');
  },

  dialPhone(e) {
    const phone = e.currentTarget.dataset.phone;
    if (phone) {
      wx.makePhoneCall({ phoneNumber: phone });
    }
  }
});
