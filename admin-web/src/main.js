import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { ElLoading } from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
// 按需组件样式由 unplugin 自动引入；函数式 API 与指令需显式补齐样式
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'
import 'element-plus/es/components/loading/style/css'
import 'element-plus/es/components/notification/style/css'
import './styles/theme.css'

const app = createApp(App)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

// v-loading 指令在去掉 app.use(ElementPlus) 后需单独注册
app.directive('loading', ElLoading.directive)

app.use(router)
app.mount('#app')
