<template>
  <div class="login-container">
    <div class="login-box">
      <div class="login-header">
        <h2>社区居家养老服务与智能派单系统</h2>
        <p class="subtitle">社区综合管理后台</p>
      </div>

      <el-form :model="loginForm" :rules="rules" ref="loginFormRef" class="login-form">
        <el-form-item prop="username">
          <el-input v-model="loginForm.username" placeholder="管理员用户名" prefix-icon="User" size="large" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="loginForm.password" type="password" placeholder="登录密码" prefix-icon="Lock" size="large" show-password @keyup.enter="handleLogin" />
        </el-form-item>
        <el-button type="primary" size="large" class="login-btn" :loading="loading" @click="handleLogin">
          立即登录后台
        </el-button>
      </el-form>

      <div class="demo-box">
        <div class="demo-title">⚡ 答辩与测试一键快捷登录：</div>
        <div class="demo-btns">
          <el-button size="small" type="success" plain @click="mockLogin('admin')">管理员 (admin)</el-button>
          <el-button size="small" type="primary" plain @click="mockLogin('staff01')">服务人员 (张玉兰)</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import request from '../../utils/request'

const router = useRouter()
const loginFormRef = ref(null)
const loading = ref(false)

const loginForm = reactive({
  username: 'admin',
  password: '123'
})

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const handleLogin = () => {
  loginFormRef.value.validate(valid => {
    if (valid) {
      loading.value = true
      request.post('/auth/login', {
        username: loginForm.username,
        password: loginForm.password
      }).then(res => {
        saveLogin(res)
      }).finally(() => {
        loading.value = false
      })
    }
  })
}

const mockLogin = (username) => {
  loading.value = true
  request.post('/auth/mock-login?username=' + username).then(res => {
    saveLogin(res)
  }).finally(() => {
    loading.value = false
  })
}

const saveLogin = (res) => {
  localStorage.setItem('admin_token', res.token)
  localStorage.setItem('admin_user', JSON.stringify(res.userInfo))
  ElMessage.success(`欢迎进入，${res.userInfo.realName || res.userInfo.username}`)
  router.push('/dashboard')
}
</script>

<style scoped>
.login-container {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #096dd9 0%, #1890ff 50%, #69c0ff 100%);
}

.login-box {
  width: 440px;
  background: #ffffff;
  padding: 40px;
  border-radius: 16px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
}

.login-header h2 {
  font-size: 20px;
  color: #1f1f1f;
  margin: 0 0 8px 0;
  text-align: center;
}

.subtitle {
  text-align: center;
  color: #8c8c8c;
  font-size: 14px;
  margin-bottom: 28px;
}

.login-btn {
  width: 100%;
  margin-top: 10px;
  height: 44px;
  font-size: 16px;
}

.demo-box {
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px dashed #d9d9d9;
}

.demo-title {
  font-size: 13px;
  color: #595959;
  margin-bottom: 12px;
}

.demo-btns {
  display: flex;
  gap: 12px;
}
</style>
