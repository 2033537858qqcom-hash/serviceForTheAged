<template>
  <div class="app-shell">
    <button v-if="sidebarOpen" class="nav-backdrop" aria-label="收起导航" @click="sidebarOpen = false"></button>
    <aside class="sidebar" :class="{ 'is-open': sidebarOpen }">
      <router-link to="/dashboard" class="brand-lockup" aria-label="颐邻社区养老，返回工作台">
        <img class="brand-symbol" src="/brand/yilin-icon.png" alt="" width="46" height="46" />
        <span><strong>颐邻<span class="brand-dot">.</span></strong><small>社区居家养老服务</small></span>
      </router-link>
      <div class="nav-group-label">服务运营</div>
      <nav aria-label="管理导航">
        <router-link v-for="item in navigation" :key="item.path" :to="item.path" class="nav-item" :class="{ 'is-active': route.path === item.path }" :aria-current="route.path === item.path ? 'page' : undefined">
          <el-icon><component :is="item.icon" /></el-icon><span>{{ item.label }}</span><span v-if="route.path === item.path" class="nav-active-mark"></span>
        </router-link>
      </nav>
      <div class="sidebar-note"><span class="station-icon"><el-icon><Location /></el-icon></span><div><strong>阳光花园社区</strong><p>让照护，离家更近一点。</p></div></div>
      <div class="sidebar-foot">社区服务管理平台 <span>01</span></div>
    </aside>
    <div class="shell-body">
      <header class="app-header">
        <div class="header-context"><button class="mobile-nav-toggle" :aria-expanded="sidebarOpen" :aria-label="sidebarOpen ? '收起导航' : '展开导航'" @click="sidebarOpen = !sidebarOpen"><el-icon><Menu /></el-icon></button><span class="breadcrumb-root">社区管理</span><span class="breadcrumb-divider">/</span><span class="breadcrumb-current">{{ currentTitle }}</span></div>
        <div class="header-account"><span class="header-date">{{ dateLabel }}</span><span class="account-divider"></span><span class="account-avatar">{{ userInitial }}</span><span class="account-name">{{ currentUser.realName || currentUser.username }}</span><el-button text class="logout-button" aria-label="退出登录" @click="logout"><el-icon><SwitchButton /></el-icon></el-button></div>
      </header>
      <main class="app-main">
        <div class="page-container">
          <router-view v-slot="{ Component, route }">
            <transition name="fade-slide" mode="out-in">
              <component :is="Component" :key="route.path" />
            </transition>
          </router-view>
        </div>
        <footer class="content-footer"><span>颐邻 · 社区居家养老服务</span><span>用心连接每一份需要</span></footer>
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
const route = useRoute()
const router = useRouter()
const sidebarOpen = ref(false)
const navigation = [
  { path: '/dashboard', label: '工作台', icon: 'Odometer' },
  { path: '/orders', label: '服务订单', icon: 'Document' },
  { path: '/dispatch', label: '智能派单', icon: 'Connection' },
  { path: '/elders', label: '老人档案', icon: 'User' },
  { path: '/services', label: '服务项目', icon: 'ShoppingBag' },
  { path: '/staff', label: '服务人员', icon: 'UserFilled' },
  { path: '/complaints', label: '反馈处理', icon: 'ChatLineRound' },
  { path: '/operation-logs', label: '操作日志', icon: 'Document' }
]
const currentTitle = computed(() => navigation.find(item => item.path === route.path)?.label || '社区服务')
const dateLabel = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())
const currentUser = computed(() => {
  try { return JSON.parse(localStorage.getItem('admin_user')) || { username: '管理员' } }
  catch { return { username: '管理员' } }
})
const userInitial = computed(() => currentUser.value.role === 'ADMIN' ? '管' : (currentUser.value.realName || currentUser.value.username || '管').slice(-2))
watch(() => route.path, () => { sidebarOpen.value = false })
const logout = () => {
  ElMessageBox.confirm('确认退出当前管理账号吗？', '退出登录', { confirmButtonText: '确认退出', cancelButtonText: '继续工作', type: 'warning' })
    .then(() => { localStorage.removeItem('admin_token'); localStorage.removeItem('admin_user'); ElMessage.success('已退出登录'); router.push('/login') })
    .catch(() => {})
}
</script>

<style scoped>
.app-shell { display: flex; min-height: 100vh; }
.sidebar { position: fixed; inset: 0 auto 0 0; z-index: 40; width: 226px; background: #fff; border-right: 1px solid var(--line); display: flex; flex-direction: column; padding: 30px 18px 18px; }
.brand-lockup { display: flex; align-items: center; gap: 12px; padding: 0 13px; margin-bottom: 45px; color: var(--ink); }
.brand-symbol { display: block; flex-shrink: 0; width: 46px; height: 46px; border-radius: 12px; object-fit: contain; }
.brand-lockup strong { display: block; font-size: 25px; font-weight: 650; letter-spacing: 3px; line-height: 1.2; }
.brand-dot { color: var(--warm); letter-spacing: 0; }
.brand-lockup small { display: block; font-size: 12px; letter-spacing: 1px; color: var(--muted); margin-top: 6px; }
.nav-group-label { padding: 0 16px; margin-bottom: 12px; font-size: 12px; color: #7a877c; letter-spacing: 2px; }
nav { display: flex; flex-direction: column; gap: 6px; }
.nav-item { position: relative; display: flex; align-items: center; gap: 13px; min-height: 47px; padding: 0 17px; border-radius: 9px; color: #64716a; font-size: 14px; transition: background .16s, color .16s; }
.nav-item > .el-icon { font-size: 19px; }
.nav-item:hover { background: #f6f8f2; color: var(--brand); }
.nav-item.is-active { background: #eaf3ee; color: var(--brand); font-weight: 600; }
.nav-active-mark { margin-left: auto; height: 6px; width: 6px; background: var(--brand); border-radius: 50%; }
.sidebar-note { display: flex; align-items: center; gap: 10px; padding: 19px 9px; margin-top: auto; border-top: 1px solid var(--line); }
.station-icon { display: grid; place-items: center; width: 32px; height: 36px; color: var(--brand); background: #f0f4e9; border-radius: 8px; }
.sidebar-note strong { display: block; font-size: 12px; font-weight: 550; }
.sidebar-note p { color: var(--muted); font-size: 12px; margin-top: 5px; }
.sidebar-foot { display: flex; justify-content: space-between; font-size: 12px; color: #829080; padding: 0 10px; }
.shell-body { margin-left: 226px; flex: 1; min-width: 0; }
.app-header { height: 76px; padding: 0 36px; display: flex; justify-content: space-between; align-items: center; background: #fff; border-bottom: 1px solid var(--line); }
.header-context, .header-account { display: flex; align-items: center; gap: 14px; font-size: 13px; }
.breadcrumb-root, .header-date { color: var(--muted); }
.breadcrumb-divider { color: #b3beb0; }
.breadcrumb-current { color: var(--ink); font-weight: 500; }
.header-date { font-size: 12px; margin-right: 5px; }
.account-divider { height: 20px; border-left: 1px solid var(--line); margin: 0 5px; }
.account-avatar { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 50%; background: #eeeede; color: #6e7045; font-size: 12px; }
.account-name { font-size: 12px; }
.logout-button { min-width: 40px; min-height: 40px; padding: 8px; color: var(--muted); border-radius: 10px; }
.app-main { padding: 32px 36px 0; }
.page-container { max-width: 1560px; margin: 0 auto; min-height: calc(100vh - 170px); }
/* 页面平滑滑动切换动画 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.24s ease, transform 0.24s cubic-bezier(0.25, 0.8, 0.25, 1);
}
.fade-slide-enter-from {
  opacity: 0;
  transform: translateX(16px);
}
.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(-16px);
}
.content-footer { max-width: 1560px; margin: 32px auto 0; padding: 20px 0; border-top: 1px solid var(--line); display: flex; justify-content: space-between; font-size: 12px; color: #768372; }
.mobile-nav-toggle { display: none; border: none; background: none; color: var(--brand); padding: 6px; font-size: 20px; }
.nav-backdrop { display: none; }
@media (max-width: 1200px) { .app-main { padding: 26px 24px 0; } .app-header { padding: 0 24px; } .sidebar { width: 208px; padding-inline: 12px; } .shell-body { margin-left: 208px; } }
@media (max-width: 900px) { .header-date, .account-divider { display: none; } }
@media (max-width: 760px) { .sidebar { width: 226px; transform: translateX(-100%); transition: transform .2s; } .sidebar.is-open { transform: translateX(0); } .shell-body { margin-left: 0; } .app-main { padding: 22px 16px 0; } .app-header { height: 64px; padding: 0 16px; } .mobile-nav-toggle { display: inline-flex; } .header-context { gap: 9px; } .account-name { display: none; } .nav-backdrop { display: block; position: fixed; inset: 0; z-index: 35; border: 0; background: #142d244d; } .content-footer { font-size: 12px; gap: 16px; } }
</style>
