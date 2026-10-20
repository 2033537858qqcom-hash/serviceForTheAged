const request = require('../../utils/request.js');
const app = getApp();

Page({
  data: {
    staffProfile: null,
    pendingAttempt: null,
    myTasks: [],
    showRecordModal: false,
    currentOrderId: null,
    recordSummary: '',
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
    this.setData({ isElderMode: app.globalData.isElderMode });
    this.loadStaffData();
  },

  onPullDownRefresh() {
    this.loadStaffData();
    wx.stopPullDownRefresh();
  },

  loadStaffData() {
    request.get('/staff/my-profile').then(profile => {
      this.setData({ staffProfile: profile });
      this.loadTasks();
    }).catch(() => {
      wx.showModal({
        title: '提示',
        content: '当前账号未绑定服务人员档案',
        showCancel: false
      });
    });
  },

  loadTasks() {
    request.get('/orders/page', { pageNum: 1, pageSize: 20 }).then(data => {
      const records = (data && data.records) || [];
      // 检查是否有待接单 (WAIT_ACCEPT 并且当前派单对应自己)
      const pending = records.find(item => item.order.status === 'WAIT_ACCEPT' && item.currentDispatch && item.currentDispatch.status === 'PENDING');
      
      // 其它正在履约的订单
      const tasks = records.filter(item => ['WAIT_VISIT', 'IN_SERVICE', 'WAIT_CONFIRM', 'COMPLETED'].includes(item.order.status));

      this.setData({
        pendingAttempt: pending ? { attempt: pending.currentDispatch, order: pending.order, elder: pending.elder } : null,
        myTasks: tasks
      });
    });
  },

  changeStatus(e) {
    const val = e.detail.value;
    const newStatus = val === '1' ? 'RESTING' : 'AVAILABLE';
    const staffId = this.data.staffProfile.profile.id;
    request.post(`/staff/${staffId}/status?status=${newStatus}`).then(() => {
      wx.showToast({ title: '工作状态已更新', icon: 'success' });
      this.loadStaffData();
    });
  },

  acceptDispatch(e) {
    const dispatchId = e.currentTarget.dataset.id;
    request.post(`/dispatch/accept/${dispatchId}`).then(() => {
      wx.showToast({ title: '接单成功，请按时上门', icon: 'success' });
      this.loadStaffData();
    });
  },

  rejectDispatch(e) {
    const dispatchId = e.currentTarget.dataset.id;
    const that = this;
    wx.showModal({
      title: '拒绝接单',
      content: '确认无法接单吗？系统将自动释放并重派其他人员。',
      confirmColor: '#ff4d4f',
      success(res) {
        if (res.confirm) {
          request.post('/dispatch/reject', { dispatchId, reason: '人员当前工作安排冲突' }).then(() => {
            wx.showToast({ title: '已拒单并释放预留', icon: 'none' });
            that.loadStaffData();
          });
        }
      }
    });
  },

  startService(e) {
    const orderId = e.currentTarget.dataset.id;
    request.post(`/fulfillment/start/${orderId}`).then(() => {
      wx.showToast({ title: '已签到，开始服务', icon: 'success' });
      this.loadStaffData();
    });
  },

  openSubmitRecordModal(e) {
    const orderId = e.currentTarget.dataset.id;
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
    this.setData({ recordSummary: e.detail.value });
  },

  submitRecord() {
    const { currentOrderId, recordSummary } = this.data;
    if (!recordSummary.trim()) {
      wx.showToast({ title: '请填写服务情况说明', icon: 'none' });
      return;
    }

    const pad = n => (n < 10 ? '0' + n : n);
    const now = new Date();
    const start = new Date(now.getTime() - 60 * 60 * 1000); // 假设施工作业1小时
    const formatTime = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    request.post('/fulfillment/submit-record', {
      orderId: currentOrderId,
      actualStartAt: formatTime(start),
      actualEndAt: formatTime(now),
      serviceSummary: recordSummary
    }).then(() => {
      wx.showToast({ title: '服务记录已提交', icon: 'success' });
      this.closeRecordModal();
      this.loadStaffData();
    });
  },

  dialPhone(e) {
    const phone = e.currentTarget.dataset.phone;
    if (phone) {
      wx.makePhoneCall({ phoneNumber: phone });
    }
  }
});
