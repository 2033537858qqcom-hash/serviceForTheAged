// app.js
// 启动配置放在入口中，避免真机增量编译遗漏新增公共模块时中断 App 注册。
const SIMULATOR_BASE_URL = 'http://localhost:8080/api';
const LAN_BASE_URL = 'http://10.146.147.237:8080/api';

function isLocalDevUrl(url) {
  const ipv6 = /^https?:\/\/\[([^\]]+)\](?=[:/]|$)/i.exec(url);
  if (ipv6) return ipv6[1] === '::1';
  const match = /^https?:\/\/([^/:]+)(?=[:/]|$)/i.exec(url);
  if (!match) return false;
  const host = match[1];
  if (/^localhost$/i.test(host)) return true;
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  if (parts[0] === 127) return true;
  if (parts[0] === 10) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  return parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31;
}

function resolveBaseUrl(customBaseUrl, onDevice) {
  const custom = typeof customBaseUrl === 'string' ? customBaseUrl.trim().replace(/\/+$/, '') : '';
  if (!custom || (onDevice && isLocalDevUrl(custom))) return onDevice ? LAN_BASE_URL : SIMULATOR_BASE_URL;
  return custom;
}

App({
  globalData: {
    baseUrl: SIMULATOR_BASE_URL,
    platform: 'devtools',
    userInfo: null,
    token: '',
    role: 'RESIDENT',
    isElderMode: false // 适老化关爱模式
  },

  onLaunch() {
    // 恢复本地存储的登录态与自定义服务器地址
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    const isElderMode = wx.getStorageSync('isElderMode') || false;
    const customBaseUrl = wx.getStorageSync('customBaseUrl');
    const device = typeof wx.getDeviceInfo === 'function' ? wx.getDeviceInfo() : wx.getSystemInfoSync();
    this.globalData.platform = device.platform || 'devtools';
    this.globalData.baseUrl = this.resolveBaseUrl(customBaseUrl);
    // 迁移手机上之前保存的 localhost，避免旧缓存继续覆盖真机地址。
    if (customBaseUrl && customBaseUrl !== this.globalData.baseUrl) wx.setStorageSync('customBaseUrl', this.globalData.baseUrl);

    if (token) {
      this.globalData.token = token;
      this.globalData.userInfo = userInfo;
      this.globalData.role = userInfo ? userInfo.role : 'RESIDENT';
    }
    this.globalData.isElderMode = isElderMode;
  },

  isRealDevice() {
    return Boolean(this.globalData.platform && this.globalData.platform !== 'devtools');
  },

  resolveBaseUrl(customBaseUrl) {
    return resolveBaseUrl(customBaseUrl, this.isRealDevice());
  },

  getServerUrls() {
    return this.isRealDevice() ? [LAN_BASE_URL] : [SIMULATOR_BASE_URL, 'http://127.0.0.1:8080/api', LAN_BASE_URL];
  },

  toggleElderMode(enable) {
    this.globalData.isElderMode = enable;
    wx.setStorageSync('isElderMode', enable);
  }
});
