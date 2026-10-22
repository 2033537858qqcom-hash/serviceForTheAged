<template>
  <el-select
    :model-value="modelValue"
    filterable
    remote
    :remote-method="search"
    :loading="loading"
    placeholder="输入姓名搜索服务人员"
    style="width: 100%"
    @visible-change="open => open && !options.length && search('')"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <el-option
      v-for="staff in options"
      :key="staff.profile.id"
      :label="label(staff)"
      :value="String(staff.profile.id)"
    />
    <template #empty>
      <p class="staff-select-empty">{{ loading ? '正在搜索…' : '没有找到符合条件的服务人员' }}</p>
    </template>
  </el-select>
</template>

<script setup>
// 远程搜索服务人员（C4）：不再一次性拉取前 50/100 人
import { ref } from 'vue'
import request from '../utils/request'
import { statusText } from '../utils/presentation.js'
const props = defineProps({
  modelValue: { type: String, default: null },
  // 预置选项（如派单推荐的人员），保证预选人员能显示姓名
  seed: { type: Array, default: () => [] }
})
defineEmits(['update:modelValue'])
const options = ref([...props.seed])
const loading = ref(false)
let seq = 0
async function search(name) {
  const id = ++seq
  loading.value = true
  try {
    const result = await request.get('/staff/page', {
      params: { pageNum: 1, pageSize: 20, auditStatus: 'APPROVED', name: name || undefined },
      silent: true
    })
    if (id === seq) options.value = result?.records || []
  } catch {
    if (id === seq) options.value = []
  } finally {
    if (id === seq) loading.value = false
  }
}
function label(staff) {
  const area = staff.profile.serviceArea || '社区服务'
  return `${staff.user?.realName || '服务人员'} · ${area} · ${statusText('staffWork', staff.profile.currentStatus)}`
}
defineExpose({ search, options })
</script>

<style scoped>
.staff-select-empty {
  padding: 12px;
  color: var(--muted);
  font-size: 13px;
  text-align: center;
}
</style>
