// CSS layout regression fixtures; this does not replace WeChat native-device QA.
// Run with Playwright available through NODE_PATH or the local Node installation.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const css = name => fs.readFileSync(path.join(root, name), 'utf8')
  .replace(/(?<![-\w])page(?=\s*[{,])/g, 'body')
  .replace(/(-?[\d.]+)rpx/g, (_, value) => `${Number(value) / 7.5}vw`);
const fixtures = {
  navigation: { file: 'custom-tab-bar/index.wxss', html: `<view class="custom-tab-bar NAVMODE"><view class="tab-bar-content">${['首页', '服务', '订单', '我的'].map(text => `<view class="tab-bar-item"><view class="icon-wrapper"><image class="tab-icon"></image></view><text class="tab-label">${text}</text></view>`).join('')}</view><view class="tab-safe-area"></view></view>`, check: '.custom-tab-bar' },
  profile: { file: 'pages/user/profile.wxss', html: `<view class="container profile-page MODE"><view class="profile-hero"><view class="profile-avatar"><image class="avatar-default-icon"></image><view class="avatar-edit-badge"></view></view><view class="profile-identity"><view class="user-name">赵德柱 · 社区居民</view><view class="user-sub"><text class="role-badge">社区居家居民</text></view></view></view></view>`, check: '.profile-hero' },
  home: { file: 'pages/index/index.wxss', html: `<view class="container home-page MODE"><view class="home-header"><view class="home-brand"><image class="home-brand-icon"></image><view class="home-brand-copy"><view class="brand-name">颐邻.</view><view class="brand-community">阳光花园社区</view></view></view><view class="home-header-deco"></view><button class="care-mode-control"><image></image><text>大字版</text></button></view><view class="service-grid-2x2"><view class="service-entry-card"><view class="service-entry-photo"></view><view class="service-card-info"><view class="grid-name">助餐送餐</view></view></view><view class="service-entry-card"><view class="service-entry-photo"></view><view class="service-card-info"><view class="grid-name">居家保洁</view></view></view></view></view>`, check: '.home-header' },
  service: { file: 'pages/service/list.wxss', html: `<view class="service-page MODE"><view class="listing-header-area"><view class="listing-title">家门口的贴心服务</view><view class="listing-caption">左右滑动挑选适合的居家照护服务</view><view class="category-bar"><view class="cat-nav-item">助餐送餐</view><view class="cat-nav-item">居家保洁</view></view></view><swiper class="service-swiper"><view class="service-scroll"><view class="service-list-content"><view class="card service-card"><view class="service-card-main"><view class="service-picture"></view><view class="service-copy"><view class="item-name">社区居家保洁</view><view class="service-meta">专业照护人员上门服务</view></view></view><view class="item-footer"><text class="item-price">¥120</text><button class="book-button">立即预约</button></view></view></view></view></swiper></view>`, check: '.service-swiper' },
  orders: { file: 'pages/order/list.wxss', html: `<view class="page-shell MODE"><view class="order-header-area"><view class="page-title">我的服务订单</view><view class="page-subtitle">查看服务安排与上门进度</view><view class="tabs-bar"><view class="tab-nav-item">全部</view><view class="tab-nav-item">待上门</view></view></view><swiper class="order-swiper"><view class="order-list-content"><view class="card">服务订单</view></view></swiper></view>`, check: '.order-swiper' },
};

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  let count = 0;
  try {
    for (const [width, height] of [[320, 568], [375, 667], [768, 1024], [1024, 768], [1366, 768]]) {
      for (const elder of [false, true]) {
        for (const [name, fixture] of Object.entries(fixtures)) {
          const page = await browser.newPage({ viewport: { width, height } });
          const html = fixture.html.replace(/NAVMODE/g, elder ? 'is-elder' : '').replace(/MODE/g, elder ? 'elder-mode' : '');
          await page.setContent(`<style>html,body{margin:0;height:100%}view,swiper,scroll-view{display:block}image{display:inline-block}button{font-family:inherit} ${css('app.wxss')} ${css(fixture.file)}</style>${html}`);
          const metrics = await page.evaluate(selector => {
            const node = document.querySelector(selector);
            const box = node.getBoundingClientRect();
            return { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, box: { x: box.x, right: box.right, bottom: box.bottom, height: box.height }, font: parseFloat(getComputedStyle(document.querySelector('.user-name,.brand-name,.listing-title,.page-title,.tab-label')).fontSize), overflow: [...node.querySelectorAll('*')].filter(el => { const b = el.getBoundingClientRect(); return b.width && (b.right > innerWidth + 1 || b.left < -1); }).map(el => el.className) };
          }, fixture.check);
          const label = `${name} ${width}x${height} ${elder ? 'elder' : 'standard'}`;
          assert(metrics.scrollWidth <= width + 1, `${label}: horizontal page overflow`);
          assert.deepEqual(metrics.overflow, [], `${label}: children overflow`);
          if (name === 'service' || name === 'orders') {
            assert(metrics.box.height > 50, `${label}: list collapsed`);
            assert(metrics.box.bottom <= height + 1, `${label}: list extends below viewport`);
          }
          if (width >= 600) assert(metrics.font <= 32, `${label}: tablet typography grows with rpx`);
          if (name === 'navigation' && width >= 600) assert.equal(metrics.box.height, (elder ? 72 : 64) + 1, `${label}: tab bar height differs from page reservation`);
          if (process.env.RESPONSIVE_SCREENSHOT_DIR && width === 768 && !elder) {
            fs.mkdirSync(process.env.RESPONSIVE_SCREENSHOT_DIR, { recursive: true });
            await page.screenshot({ path: path.join(process.env.RESPONSIVE_SCREENSHOT_DIR, `${name}-tablet.png`) });
          }
          await page.close();
          count++;
        }
      }
    }
    console.log(`PASS: ${count} CSS layout fixtures across phone/tablet sizes and standard/elder modes.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
