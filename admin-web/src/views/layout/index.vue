<template>
  <el-container class="layout-container">
    <el-aside width="240px" class="aside">
      <div class="logo-box">
        <span class="logo-icon">🏡</span>
        <span class="logo-text">社区居家养老平台</span>
      </div>
      <el-menu
        :default-active="activeRoute"
        router
        background-color="#001529"
        text-color="#rgba(255,255,255,0.65)"
        active-text-color="#ffffff"
        class="menu"
      >
        <el-menu-item index="/dashboard">
          <el-icon><Odometer /></el-icon>
          <span>数据监控大屏</span>
        </el-menu-item>
        <el-menu-item index="/orders">
          <el-icon><Document /></el-icon>
          <span>订单综合管理</span>
        </el-menu-item>
        <el-menu-item index="/dispatch">
          <el-icon><Operation /></el-icon>
          <span>智能调度 / 待人工</span>
        </el-menu-item>
        <el-menu-item index="/elders">
          <el-icon><User /></el-icon>
          <span>老人档案与家属绑定</span>
        </el-menu-item>
        <el-menu-item index="/services">
          <el-icon><ShoppingBag /></el-icon>
          <span>养老服务项目配置</span>
        </el-menu-item>
        <el-menu-item index="/staff">
          <el-icon><UserFilled /></el-icon>
          <span>人员资质与排班管理</span>
        </el-menu-item>
        <el-menu-item index="/complaints">
          <el-icon><ChatLineRound /></el-icon>
          <span>服务投诉与反馈处理</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header flex-between">
        <div class="header-left">
          <span class="page-title">{{ currentTitle }}</span>
        </div>
        <div class="header-right flex-row">
          <el-tag type="success" size="small" style="margin-right: 12px;">社区管理端已联通</el-tag>
          <span class="user-greeting">欢迎您，{{ currentUser.realName || currentUser.username }}</span>
          <el-button type="danger" link @click="logout" style="margin-left: 16px;">退出登录</el-button>
        </div>
      </el-header>

      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()

const activeRoute = computed(() => route.path)
const currentTitle = computed(() => route.meta.title || '社区居家养老管理后台')

const currentUser = computed(() => {
  try {
    return JSON.parse(localStorage.getItem('admin_user')) || { username: '管理员' }
  } catch (e) {
    return { username: '管理员' }
  }
})

const logout = () => {
  ElMessageBox.confirm('确认退出社区管理后台吗？', '提示', {
    confirmButtonText: '确定退出',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
    ElMessage.success('已安全退出')
    router.push('/login')
  })
}
</script>

<style scoped>
.layout-container {
  height: 100vh;
}

.aside {
  background-color: #001529;
  display: flex;
  flex-direction: column;
}

.logo-box {
  height: 64px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  background-color: #002140;
}

.logo-icon {
  font-size: 26px;
  margin-right: 10px;
}

.logo-text {
  color: #ffffff;
  font-size: 16px;
  font-weight: bold;
}

.menu {
  border-right: none;
  flex: 1;
}

.header {
  height: 64px;
  background-color: #ffffff;
  border-bottom: 1px solid #e8e8e8;
  padding: 0 24px;
}

.page-title {
  font-size: 18px;
  font-weight: bold;
  color: #262626;
}

.user-greeting {
  font-size: 14px;
  color: #595959;
}

.main-content {
  background-color: #f0f2f5;
  padding: 24px;
  overflow-y: auto;
}

.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.flex-row {
  display: flex;
  align-items: center;
}
</style>
