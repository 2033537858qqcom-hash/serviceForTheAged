const navigation = require('../utils/navigation.js');

Component({
  data: {
    selected: 0,
    isElderMode: false,
    list: [
      {
        pagePath: "pages/index/index",
        text: "首页",
        iconPath: "/assets/icons/home-muted.png",
        selectedIconPath: "/assets/icons/home.png"
      },
      {
        pagePath: "pages/service/list",
        text: "服务",
        iconPath: "/assets/icons/service-muted.png",
        selectedIconPath: "/assets/icons/service.png"
      },
      {
        pagePath: "pages/order/list",
        text: "订单",
        iconPath: "/assets/icons/order-muted.png",
        selectedIconPath: "/assets/icons/order.png"
      },
      {
        pagePath: "pages/user/profile",
        text: "我的",
        iconPath: "/assets/icons/user-muted.png",
        selectedIconPath: "/assets/icons/user.png"
      }
    ]
  },
  lifetimes: {
    attached() {
      this.syncFromRoute();
    }
  },
  pageLifetimes: {
    show() {
      this.syncFromRoute();
    }
  },
  methods: {
    syncState(index, isElderMode) {
      if (typeof isElderMode === 'undefined') {
        try {
          const app = typeof getApp === 'function' ? getApp() : null;
          isElderMode = app && app.globalData ? app.globalData.isElderMode : false;
        } catch (_) {
          isElderMode = false;
        }
      }
      const patch = {};
      if (Number.isInteger(index) && this.data.list[index] && this.data.selected !== index) {
        patch.selected = index;
      }
      if (this.data.isElderMode !== Boolean(isElderMode)) {
        patch.isElderMode = Boolean(isElderMode);
      }
      if (Object.keys(patch).length) {
        this.setData(patch);
      }
    },
    syncFromRoute() {
      try {
        const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
        const route = pages.length ? pages[pages.length - 1].route : '';
        const index = this.data.list.findIndex(item => item.pagePath === route);
        if (index >= 0) {
          this.syncState(index);
        }
      } catch (_) {}
    },
    switchTab(e) {
      const index = Number(e.currentTarget.dataset.index);
      const item = this.data.list[index];
      if (!item || this._switching || index === this.data.selected) return;
      const previous = this.data.selected;
      this._switching = true;
      this.syncState(index);
      navigation.switchTab({
        url: '/' + item.pagePath,
        fail: () => {
          this.syncState(previous);
        },
        complete: () => {
          this._switching = false;
        }
      });
    }
  }
});
