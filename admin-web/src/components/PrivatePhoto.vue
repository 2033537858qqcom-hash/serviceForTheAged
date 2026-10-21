<template>
  <el-image v-if="url" :src="url" :preview-src-list="[url]" fit="cover" class="private-photo" preview-teleported />
  <span v-else class="photo-placeholder">{{ failed ? '照片暂不可用' : '照片加载中…' }}</span>
</template>
<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
const props = defineProps({ source: { type: String, required: true } })
const url = ref('')
const failed = ref(false)
let controller
function clear() {
  controller?.abort()
  if (url.value) URL.revokeObjectURL(url.value)
  url.value = ''
}
watch(() => props.source, async source => {
  clear()
  failed.value = false
  const current = controller = new AbortController()
  const token = localStorage.getItem('admin_token')
  try {
    if (!/^\/media\/private\/fulfillment\/\d+\/\d+\/[a-f0-9-]{36}\.(jpg|jpeg|png|webp)$/.test(source)) throw new Error('invalid photo')
    const response = await fetch('/api' + source, {
      headers: { Authorization: 'Bearer ' + token }, cache: 'no-store', signal: current.signal
    })
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error('photo unavailable')
    const blob = await response.blob()
    if (!current.signal.aborted && token === localStorage.getItem('admin_token')) url.value = URL.createObjectURL(blob)
  } catch (error) {
    if (!current.signal.aborted) failed.value = true
  }
}, { immediate: true })
onBeforeUnmount(clear)
</script>
<style scoped>
.private-photo { width: 112px; height: 88px; border-radius: 12px; margin: 4px 12px 4px 0; }
.photo-placeholder { display: inline-flex; align-items: center; justify-content: center; width: 112px; min-height: 88px; background: #f2f5ef; color: #647168; font-size: 12px; border-radius: 12px; margin-right: 12px; }
</style>
