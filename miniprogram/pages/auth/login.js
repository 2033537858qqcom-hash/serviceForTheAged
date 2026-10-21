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
    isAgreed: false,
    loggingIn: false,
    showAccountModal: false,
    accountTab: 'login', // 'login' or 'register'
    formUsername: '',
    formPassword: '',
    formRealName: '',
    formPhone: '',
    showDocModal: false,
    docTitle: '',
    docContent: ''
  },

  onLoad(options) {
    try { this.redirectUrl = options?.redirect ? decodeURIComponent(options.redirect) : ''; }
    catch (_) { this.redirectUrl = ''; }

    const app = getAppSafe();
    const token = app.globalData?.token;
    if (token) {
      navigation.afterLogin(this.redirectUrl);
    }
  },

  toggleAgreement() {
    this.setData({ isAgreed: !this.data.isAgreed });
  },

  checkAgreement() {
    if (!this.data.isAgreed) {
      wx.showToast({
        title: '请先勾选底部的服务协议与隐私政策',
        icon: 'none',
        duration: 2500
      });
      return false;
    }
    return true;
  },

  onUnload() {
    this._disposed = true;
    if (this._loginJob) wx.hideLoading();
    this._loginJob = null;
  },

  runLogin(action, title = '正在登录…') {
    if (this._loginJob || this._disposed) return Promise.resolve();
    const state = getAppSafe().globalData;
    const job = { baseUrl: state.baseUrl, token: state.token };
    this._loginJob = job;
    this.setData({ loggingIn: true });
    wx.showLoading({ title, mask: true });
    const valid = () => !this._disposed && this._loginJob === job &&
      getAppSafe().globalData.baseUrl === job.baseUrl && getAppSafe().globalData.token === job.token;
    return Promise.resolve().then(() => {
      if (valid()) return action(valid);
    }).then(result => {
      if (valid() && result) {
        this.closeAccountModal();
        this.onLoginSuccess(result);
      }
    }).catch(() => {}).finally(() => {
      if (this._loginJob !== job) return;
      this._loginJob = null;
      wx.hideLoading();
      if (!this._disposed) this.setData({ loggingIn: false });
    });
  },

  handleQuickLogin() {
    if (!this.checkAgreement()) return;
    return this.runLogin(valid => new Promise((resolve, reject) => {
      wx.login({
        timeout: 10000,
        success: res => {
          if (!res.code) {
            if (valid()) wx.showToast({ title: '获取微信登录凭证失败，请重试', icon: 'none' });
            reject(new Error('Missing login code'));
            return;
          }
          resolve(res.code);
        },
        fail: () => {
          if (valid()) wx.showToast({ title: '微信登录失败，请重试或使用账号登录', icon: 'none' });
          reject(new Error('WeChat login failed'));
        }
      });
    }).then(code => {
      if (valid()) return request.post('/auth/wechat-login', { code, role: 'RESIDENT' });
    }));
  },

  // 演示答辩一键体验快捷入口 (老人/家属/师傅/管理)
  openRoleSwitchSheet() {
    const roles = [
      { username: 'resident01', name: '赵大爷', desc: '老人本人 (阳光社区长辈)' },
      { username: 'family01', name: '赵志强', desc: '家属代约 (社区居民)' },
      { username: 'staff01', name: '张玉兰', desc: '服务师傅 (专业居家护理)' },
      { username: 'admin', name: '系统管理员', desc: '管理员 (调度运营中心)' }
    ];

    const that = this;
    wx.showActionSheet({
      itemList: roles.map(r => `${r.name} · ${r.desc}`),
      success(res) {
        const target = roles[res.tapIndex];
        if (target) {
          that.setData({ isAgreed: true });
          return that.runLogin(() => request.post('/auth/mock-login?username=' + encodeURIComponent(target.username)), `正在以 ${target.name} 登录…`);
        }
      }
    });
  },

  // 账号密码登录/注册弹窗
  openAccountModal() {
    this.setData({
      showAccountModal: true,
      accountTab: 'login'
    });
  },

  closeAccountModal() {
    this.setData({ showAccountModal: false });
  },

  switchAccountTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ accountTab: tab });
  },

  onInputUsername(e) { this.setData({ formUsername: e.detail.value }); },
  onInputPassword(e) { this.setData({ formPassword: e.detail.value }); },
  onInputRealName(e) { this.setData({ formRealName: e.detail.value }); },
  onInputPhone(e) { this.setData({ formPhone: e.detail.value }); },

  submitAccountForm() {
    if (!this.checkAgreement()) return;

    const { accountTab, formUsername, formPassword, formRealName, formPhone } = this.data;
    if (!formUsername.trim()) {
      wx.showToast({ title: '请输入账号或手机号', icon: 'none' });
      return;
    }
    if (!formPassword.trim()) {
      wx.showToast({ title: '请输入登录密码', icon: 'none' });
      return;
    }

    if (accountTab === 'register') {
      if (!formRealName.trim()) {
        wx.showToast({ title: '请输入真实姓名', icon: 'none' });
        return;
      }
      if (!/^1[3-9]\d{9}$/.test(formPhone.trim())) {
        wx.showToast({ title: '请输入有效的11位手机号', icon: 'none' });
        return;
      }

      return this.runLogin(() => request.post('/auth/register', {
        username: formUsername.trim(), password: formPassword,
        realName: formRealName.trim(), phone: formPhone.trim()
      }), '正在注册…');
    }
    return this.runLogin(() => request.post('/auth/login', {
      username: formUsername.trim(), password: formPassword
    }));
  },

  // 统一登录成功状态更新与跳转
  onLoginSuccess(data) {
    if (this._disposed) return;
    if (!data || typeof data.token !== 'string' || !data.token || !data.userInfo || !data.userInfo.role) {
      wx.showToast({ title: '登录响应异常，请重新登录', icon: 'none' });
      return;
    }
    app.globalData.token = data.token;
    app.globalData.userInfo = data.userInfo;
    app.globalData.role = data.userInfo.role;

    wx.setStorageSync('token', data.token);
    wx.setStorageSync('userInfo', data.userInfo);

    wx.showToast({
      title: `欢迎，${data.userInfo.realName || data.userInfo.username}`,
      icon: 'success'
    });

    navigation.afterLogin(this.redirectUrl);
  },

  // 游客模式先去逛逛
  skipToHome() {
    navigation.switchTab({ url: '/pages/index/index' });
  },

  // 打开协议条款弹窗
  openDocModal(e) {
    const type = e.currentTarget.dataset.type;
    if (type === 'service') {
      this.setData({
        showDocModal: true,
        docTitle: '颐邻社区居家养老服务协议',
        docContent: `一、服务原则
1. 颐邻社区居家养老服务致力于为社区长者及家属提供便民、专业、温暖的居家照护服务，包含助餐送餐、日常保洁、代买代办、陪同办事等便民项目。
2. 平台派单将根据服务人员专业技能、服务网格位置、服务评分与时段工作余量进行综合匹配。

二、用户权益与保障
1. 居民与家属可真实反映服务情况，服务完成后享有质量评价与服务复核权利。
2. 平台严格保障长者身体健康、上门安全与财产安全，对所有上岗服务人员实行资质审核与规范管理。`
      });
    } else {
      this.setData({
        showDocModal: true,
        docTitle: '颐邻养老隐私保护政策',
        docContent: `一、信息收集与使用
1. 为保障养老服务准确送达，平台仅在您明确授权后收集必要的联系方式、上门服务地址、紧急联系人与照护备注信息。
2. 所有健康状况、家庭病史与身份凭证信息均严格用于社区服务核验与安全照护，实行加密隔离存储。

二、隐私承诺
1. 平台绝不会将长者或家庭隐私信息提供给无关第三方商业机构。
2. 您可随时在“个人中心”查询、更新或撤销相关档案授权。`
      });
    }
  },

  closeDocModal() {
    this.setData({ showDocModal: false });
  },

  agreeAndCloseDoc() {
    this.setData({
      showDocModal: false,
      isAgreed: true
    });
  }
});
