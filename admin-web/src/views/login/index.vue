<template>
  <main class="login-page">
    <section class="login-story"><div class="login-brand"><span class="login-brand-icon"><el-icon><House /></el-icon></span><span><strong>颐邻.</strong><small>社区居家养老服务</small></span></div><div class="story-copy"><span class="story-eyebrow">熟悉的社区 · 用心的照护</span><h1>把照护带到家，<br />把安心留给家人。</h1><p>连接社区、家属与服务人员，<br />让每一次预约，都有妥帖的安排。</p><div class="story-journey"><div><span>01</span><strong>预约服务</strong></div><i></i><div><span>02</span><strong>人员安排</strong></div><i></i><div><span>03</span><strong>上门照护</strong></div></div></div><div class="story-bottom"><span>阳光花园社区</span><span>让照护，离家更近一点。</span></div></section>
    <section class="login-form-side"><div class="login-form-container"><span class="eyebrow">社区管理工作台</span><h2>欢迎回来</h2><p class="login-description">登录管理账号，开始今天的社区服务工作。</p><el-form ref="loginFormRef" :model="loginForm" :rules="rules" label-position="top" @submit.prevent="handleLogin"><el-form-item label="账号" prop="username"><el-input v-model="loginForm.username" placeholder="请输入管理员账号" prefix-icon="User" size="large" autocomplete="username" /></el-form-item><el-form-item label="密码" prop="password"><el-input v-model="loginForm.password" type="password" placeholder="请输入登录密码" prefix-icon="Lock" size="large" show-password autocomplete="current-password" @keyup.enter="handleLogin" /></el-form-item><el-button type="primary" class="login-submit" size="large" :loading="loading" @click="handleLogin">登录工作台<el-icon><ArrowRight /></el-icon></el-button></el-form><p class="login-help"><el-icon><Service /></el-icon>账号使用遇到问题，请联系社区管理员</p><details v-if="showDemo" class="demo-access"><summary>演示环境 · 快速进入</summary><p>仅供本地演示与页面测试使用</p><el-button :loading="loading" @click="mockLogin('admin')">使用管理员演示账号</el-button></details></div><footer>颐邻 · 社区居家养老服务平台</footer></section>
  </main>
</template>
<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import request from '../../utils/request'
const router = useRouter()
const loginFormRef = ref(null), loading = ref(false)
const showDemo = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO === 'true'
const loginForm = reactive({ username: '', password: '' })
const rules = { username: [{ required: true, message: '请输入管理员账号', trigger: 'blur' }], password: [{ required: true, message: '请输入登录密码', trigger: 'blur' }] }
async function handleLogin() {
  if (loading.value) return
  const valid = await loginFormRef.value.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try { saveLogin(await request.post('/auth/login', loginForm)) } catch {} finally { loading.value = false }
}
async function mockLogin(username) { loading.value = true; try { saveLogin(await request.post('/auth/mock-login?username=' + encodeURIComponent(username))) } catch {} finally { loading.value = false } }
function saveLogin(result) {
  if (result.userInfo?.role !== 'ADMIN') { ElMessage.warning('请使用管理员账号登录社区管理后台'); return }
  localStorage.setItem('admin_token', result.token)
  localStorage.setItem('admin_user', JSON.stringify(result.userInfo))
  ElMessage.success('欢迎回来，' + (result.userInfo.realName || result.userInfo.username))
  router.push('/dashboard')
}
</script>
<style scoped>
.login-page { display: grid; grid-template-columns: 1.05fr 1fr; min-height: 100vh; background: #fff; }
.login-story { position: relative; min-height: 100vh; display: flex; flex-direction: column; overflow: hidden; background: #eaf0e3; padding: 48px clamp(35px, 6vw, 95px); }
.login-story::before, .login-story::after { content: ''; position: absolute; width: 570px; height: 570px; border: 1px solid #d4dfc9; border-radius: 50%; pointer-events: none; }
.login-story::before { right: -280px; bottom: -250px; }
.login-story::after { right: -220px; bottom: -300px; }
.login-brand { display: flex; align-items: center; gap: 12px; }
.login-brand-icon { display: grid; place-items: center; height: 45px; width: 42px; color: #fff; background: var(--brand); border-radius: 12px 12px 12px 3px; font-size: 23px; }
.login-brand strong { font-size: 25px; display: block; font-weight: 650; letter-spacing: 2px; color: #244333; }
.login-brand small { display: block; color: #5b7057; font-size: 10px; margin-top: 4px; letter-spacing: 1px; }
.story-copy { position: relative; z-index: 1; margin: auto 0; padding: 70px 0; }
.story-eyebrow { font-size: 12px; color: #607954; letter-spacing: 2px; }
.story-copy h1 { margin: 24px 0; font-size: clamp(30px, 3.4vw, 49px); font-weight: 550; color: #2a4d37; line-height: 1.65; letter-spacing: -1px; }
.story-copy > p { font-size: 14px; color: #66775c; line-height: 2; }
.story-journey { display: flex; align-items: center; margin-top: 53px; gap: 15px; max-width: 380px; }
.story-journey > div { min-width: 67px; }
.story-journey span { display: block; font-size: 10px; color: #718265; letter-spacing: 2px; }
.story-journey strong { display: block; font-weight: 500; font-size: 12px; color: #465e3b; margin-top: 9px; }
.story-journey i { width: 40px; height: 1px; background: #b9c8ac; }
.story-bottom { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 14px; color: #6c7d61; font-size: 10px; position: relative; z-index: 1; }
.login-form-side { position: relative; display: flex; align-items: center; justify-content: center; padding: 70px 35px 100px; }
.login-form-container { width: 360px; max-width: 100%; }
.login-form-container > h2 { font-size: 31px; line-height: 1.5; font-weight: 600; margin: 12px 0; letter-spacing: -.8px; }
.login-description { font-size: 13px; color: var(--muted); line-height: 1.8; margin-bottom: 35px; }
.login-form-container :deep(.el-form-item) { margin-bottom: 23px; }
.login-form-container :deep(.el-input__wrapper) { min-height: 47px; background: #fcfdf9; }
.login-submit { width: 100%; min-height: 47px; margin-top: 7px; font-size: 14px; }
.login-submit .el-icon { margin-left: 15px; }
.login-help { display: flex; align-items: center; justify-content: center; gap: 7px; color: var(--muted); font-size: 11px; margin-top: 23px; }
.demo-access { border-top: 1px solid var(--line); margin-top: 35px; padding-top: 20px; color: var(--muted); }
.demo-access summary { font-size: 11px; cursor: pointer; width: fit-content; }
.demo-access p { font-size: 10px; margin: 14px 0 11px; }
.demo-access .el-button { font-size: 11px; }
.login-form-side footer { position: absolute; bottom: 35px; font-size: 10px; color: #7e8879; }
@media (max-width: 860px) { .login-page { grid-template-columns: .85fr 1fr; } .login-story { padding: 36px 28px; } .story-copy h1 { font-size: 30px; } .story-journey { gap: 9px; } .story-journey i { width: 20px; } .story-bottom span:last-child { display: none; } }
@media (max-width: 640px) { .login-page { display: block; } .login-story { min-height: auto; padding: 25px 26px; } .story-copy { padding: 25px 0 7px; } .story-copy h1 { margin: 12px 0 0; font-size: 27px; } .story-copy h1 br { display: none; } .story-copy > p, .story-journey, .story-bottom, .story-eyebrow { display: none; } .login-form-side { padding: 40px 27px 100px; min-height: calc(100vh - 180px); } .login-form-container { width: 100%; max-width: 390px; } }
</style>