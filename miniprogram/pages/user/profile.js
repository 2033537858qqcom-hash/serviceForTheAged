const navigation = require('../../utils/navigation.js');
const { syncTabBar } = require('../../utils/tab-bar.js');
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
    userInfo: null,
    staffProfile: null,
    staffSkills: [],
    staffSkillsDesc: '',
    isElderMode: false,
    isDevMode: false,
    currentBaseUrl: 'http://localhost:8080/api',
    logoutSheet: false,
    roleTextMap: {
      'ADMIN': '社区系统管理员',
      'STAFF': '认证上门服务人员',
      'RESIDENT': '社区居家居民'
    }
  },

  onShow() {
    syncTabBar(this, 3);
    const app = getAppSafe();
    const patch = {};
    const isDev = /^https?:\/\/(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01]))/i.test(app.globalData?.baseUrl || '');
    const state = {
      userInfo: app.globalData?.userInfo || null,
      isElderMode: Boolean(app.globalData?.isElderMode),
      isDevMode: isDev,
      currentBaseUrl: app.globalData?.baseUrl || 'http://localhost:8080/api'
    };
    for (const key of Object.keys(state)) {
      if (this._shownState?.[key] !== state[key]) patch[key] = state[key];
    }
    this._shownState = state;
    if (Object.keys(patch).length) this.setData(patch);
    if (state.userInfo?.role === 'STAFF') {
      this.loadStaffProfile();
    }
  },

  loadStaffProfile() {
    return request.get('/staff/my-profile').then(res => {
      if (!res) return;
      const profile = res.profile || null;
      const skills = res.skills || [];
      const skillsDesc = skills.map(s => s.skillName).join(' · ');
      this.setData({
        staffProfile: profile,
        staffSkills: skills,
        staffSkillsDesc: skillsDesc || '养老照护专业认证 · 社区审核合格'
      });
    }).catch(() => {});
  },

  onModeChange(e) {
    const isElder = e.detail.value;
    app.toggleElderMode(isElder);
    syncTabBar(this, 3);
    this.setData({ isElderMode: isElder });
  },

  /**
   * ActionSheet 1: 演示账号角色一键切换 (答辩与评测利器)
   */
  openRoleSwitchSheet() {
    const roles = [
      { username: 'resident01', name: '赵大爷', desc: '老人本人 (阳光社区长辈)' },
      { username: 'family01', name: '赵志强', desc: '家属代约 (社区居民)' },
      { username: 'staff01', name: '张玉兰', desc: '服务师傅 (专业居家护理)' }
    ];

    const that = this;
    wx.showActionSheet({
      itemList: roles.map(r => `${r.name} · ${r.desc}`),
      success(res) {
        const target = roles[res.tapIndex];
        if (target) {
          wx.showLoading({ title: `正在切换至${target.name}...` });
          request.post('/auth/mock-login?username=' + encodeURIComponent(target.username)).then(loginRes => {
            wx.hideLoading();
            app.globalData.token = loginRes.token;
            app.globalData.userInfo = loginRes.userInfo;
            app.globalData.role = loginRes.userInfo.role;
            wx.setStorageSync('token', loginRes.token);
            wx.setStorageSync('userInfo', loginRes.userInfo);

            that.setData({ userInfo: loginRes.userInfo });
            wx.showToast({ title: `已登录为 ${loginRes.userInfo.realName}`, icon: 'success' });

            const dest = loginRes.userInfo.role === 'STAFF' ? '/pages/staff/workbench' : '/pages/index/index';
            navigation.switchTab({ url: dest, fail: () => navigation.redirectTo({ url: dest }) });
          }).catch(() => {
            wx.hideLoading();
          });
        }
      }
    });
  },

  /**
   * ActionSheet 2: 社区养老便民与应急服务热线
   */
  contactSupportSheet() {
    const isStaff = this.data.userInfo?.role === 'STAFF';
    const contacts = isStaff ? [
      { label: '呼叫 阳光社区助老调度中心 (010-88886699)', phone: '010-88886699' },
      { label: '呼叫 责任网格长与站长 (13800000000)', phone: '13800000000' },
      { label: '拨打 120 医疗急救热线 (120)', phone: '120' }
    ] : [
      { label: '拨打 社区24小时养老服务热线 (010-88886666)', phone: '010-88886666' },
      { label: '拨打 社区家庭医生健康直通车 (010-88886688)', phone: '010-88886688' },
      { label: '呼叫 阳光社区责任网格员小王 (13800000000)', phone: '13800000000' }
    ];

    wx.showActionSheet({
      itemList: contacts.map(c => c.label),
      success(res) {
        const target = contacts[res.tapIndex];
        if (target) {
          wx.makePhoneCall({
            phoneNumber: target.phone
          });
        }
      }
    });
  },

  /**
   * ActionSheet 3: 退出登录优雅二次确认
   */
  confirmLogout() {
    this.setData({ logoutSheet: true });
  },

  closeLogoutSheet() {
    this.setData({ logoutSheet: false });
  },

  /**
   * ActionSheet 4: 切换后端服务接口地址 (模拟器/真机调试)
   */
  changeServerUrl() {
    const defaultUrls = app.getServerUrls();
    const that = this;
    wx.showActionSheet({
      itemList: [
        ...defaultUrls.map(url => `${/localhost|127\.0\.0\.1/.test(url) ? '电脑模拟器' : '手机真机/局域网'}: ${url}`),
        '手动输入自定义服务器地址'
      ],
      success(res) {
        if (res.tapIndex < defaultUrls.length) {
          const selected = defaultUrls[res.tapIndex];
          app.globalData.baseUrl = selected;
          wx.setStorageSync('customBaseUrl', selected);
          that.setData({ currentBaseUrl: selected });
          wx.showToast({ title: '已切换服务地址', icon: 'success' });
        } else if (res.tapIndex === defaultUrls.length) {
          wx.showModal({
            title: '自定义后端地址',
            editable: true,
            placeholderText: '例如: ' + (app.getServerUrls().find(url => !/localhost|127\.0\.0\.1/.test(url)) || 'http://电脑IP:8080/api'),
            success(modalRes) {
              if (modalRes.confirm && modalRes.content.trim()) {
                const url = app.resolveBaseUrl(modalRes.content);
                app.globalData.baseUrl = url;
                wx.setStorageSync('customBaseUrl', url);
                that.setData({ currentBaseUrl: url });
                wx.showToast({ title: '已更新地址', icon: 'success' });
              }
            }
          });
        }
      }
    });
  },

  wechatLogin() {
    wx.showLoading({ title: '正在登录...' });
    wx.login({
      success: (loginRes) => {
        if (loginRes.code) {
          request.post('/auth/wechat-login', {
            code: loginRes.code,
            nickName: '微信居民用户',
            avatarUrl: ''
          }).then(res => {
            wx.hideLoading();
            app.globalData.token = res.token;
            app.globalData.userInfo = res.userInfo;
            app.globalData.role = res.userInfo.role;
            wx.setStorageSync('token', res.token);
            wx.setStorageSync('userInfo', res.userInfo);

            this.setData({ userInfo: res.userInfo });
            wx.showToast({ title: '微信登录成功', icon: 'success' });
          }).catch(() => {
            wx.hideLoading();
          });
        } else {
          wx.hideLoading();
          wx.showToast({ title: '获取微信登录码失败: ' + loginRes.errMsg, icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '调用微信登录失败', icon: 'none' });
      }
    });
  },

  logout() {
    this.setData({ logoutSheet: false, staffProfile: null, staffSkills: [], staffSkillsDesc: '' });
    app.globalData.token = '';
    app.globalData.userInfo = null;
    app.globalData.role = 'RESIDENT';
    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
    this.setData({ userInfo: null });
    wx.showToast({ title: '已安全退出登录', icon: 'none' });
    navigation.toLogin('/pages/user/profile');
  },

  goToLogin() {
    navigation.navigateTo({ url: '/pages/auth/login' });
  },

  goToOrderList(e) {
    const status = (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.status) || '';
    app.globalData.orderStatusFilter = status;
    navigation.switchTab({ url: '/pages/order/list' });
  },

  goToElderList() {
    navigation.navigateTo({ url: '/pages/user/elder-list' });
  },

  goToFamily() {
    navigation.navigateTo({ url: '/pages/user/family' });
  },

  goToWorkbench() {
    navigation.switchTab({
      url: '/pages/staff/workbench',
      fail: () => navigation.navigateTo({ url: '/pages/staff/workbench' })
    });
  },

  showSkillsModal() {
    const skills = this.data.staffSkills || [];
    const skillList = skills.length 
      ? skills.map(s => `· ${s.skillName}${s.certificateNo ? ' (' + s.certificateNo + ')' : ''}`).join('\n') 
      : '· 居家养老专业照护资格认证\n· 助餐、助洁规范操作达标\n· 应急救护常识合格认证';
    wx.showModal({
      title: '服务人员执业资质',
      content: `姓名：${this.data.userInfo?.realName || '认证服务人员'}\n社区核验：已审核通过\n\n认证资质：\n${skillList}`,
      showCancel: false,
      confirmText: '确定'
    });
  }
});
