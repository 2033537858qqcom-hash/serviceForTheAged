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

  // 微信/手机号快捷授权登录
  handleQuickLogin() {
    if (!this.checkAgreement()) return;

    wx.showLoading({ title: '正在登录…' });
    wx.login({
      success: res => {
        if (res.code) {
          request.post('/auth/wechat-login', {
            code: res.code,
            role: 'RESIDENT'
          }).then(loginRes => {
            wx.hideLoading();
            this.onLoginSuccess(loginRes);
          }).catch(error => {
            wx.hideLoading();
            // 请求未到达后端时保留网络提示，不误报为微信授权配置缺失。
            if (error?.isNetworkError) return;
            // 若后台未配置微信密钥或微信授权失败，友好引导使用演示通道或账号密码
            wx.showModal({
              title: '提示',
              content: '未检测到微信授权环境，可直接通过下方“评测通道”一键登录体验！',
              confirmText: '立即体验',
              cancelText: '账号登录',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  this.openRoleSwitchSheet();
                } else {
                  this.openAccountModal();
                }
              }
            });
          });
        } else {
          wx.hideLoading();
          wx.showToast({ title: '获取微信登录Code失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '调用微信登录失败', icon: 'none' });
      }
    });
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
          wx.showLoading({ title: `正在以 ${target.name} 登录...` });
          request.post('/auth/mock-login?username=' + encodeURIComponent(target.username)).then(loginRes => {
            wx.hideLoading();
            that.onLoginSuccess(loginRes);
          }).catch(() => {
            wx.hideLoading();
          });
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
      if (!formPhone.trim() || formPhone.length !== 11) {
        wx.showToast({ title: '请输入有效的11位手机号', icon: 'none' });
        return;
      }

      wx.showLoading({ title: '正在注册…' });
      request.post('/auth/register', {
        username: formUsername,
        password: formPassword,
        realName: formRealName,
        phone: formPhone
      }).then(res => {
        wx.hideLoading();
        this.closeAccountModal();
        this.onLoginSuccess(res);
      }).catch(() => wx.hideLoading());
    } else {
      wx.showLoading({ title: '正在登录…' });
      request.post('/auth/login', {
        username: formUsername,
        password: formPassword
      }).then(res => {
        wx.hideLoading();
        this.closeAccountModal();
        this.onLoginSuccess(res);
      }).catch(() => wx.hideLoading());
    }
  },

  // 统一登录成功状态更新与跳转
  onLoginSuccess(data) {
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
