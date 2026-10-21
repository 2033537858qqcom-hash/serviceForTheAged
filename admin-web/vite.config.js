import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 第三方依赖拆成独立 chunk，便于缓存并避免单个 chunk 超过 500kB 告警
function vendorChunk(id) {
  if (!id.includes('node_modules')) return undefined
  if (id.includes('@element-plus/icons-vue')) return 'vendor-element-icons'
  if (id.includes('element-plus')) return 'vendor-element-plus'
  if (id.includes('echarts') || id.includes('zrender')) return 'vendor-echarts'
  if (/[\\/]node_modules[\\/](@vue|vue|vue-router)[\\/]/.test(id)) return 'vendor-vue'
  return undefined
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    // element-plus 采用全量注册（约 900kB / gzip ~280kB），已拆为独立 vendor chunk 长期缓存；
    // 按需引入改动面较大，暂以 1000kB 阈值约束业务 chunk，新增大依赖仍会告警。
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: { manualChunks: vendorChunk }
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
})
