<template>
  <section>
    <PageHeader eyebrow="审计记录" title="操作日志" description="查看管理员已完成的操作与审计记录"><template #actions><el-button :loading="loading" @click="load">刷新记录</el-button></template></PageHeader>
    <div class="panel">
      <el-skeleton :loading="loading && !rows.length" animated :rows="6">
      <template #default>
      <el-table v-loading="loading && rows.length > 0" :data="rows" empty-text="暂无管理操作记录">
        <el-table-column prop="created_at" label="操作时间" min-width="180" />
        <el-table-column prop="operator_name" label="操作人" min-width="120" />
        <el-table-column prop="action" label="操作动作" min-width="230" />
        <el-table-column prop="target_id" label="对象编号" min-width="180" />
        <el-table-column prop="details" label="操作信息" min-width="250" show-overflow-tooltip />
      </el-table>
      </template>
      </el-skeleton>
      <el-pagination v-model:current-page="page" :page-size="20" :total="total" layout="total, prev, pager, next" @current-change="load" />
    </div>
  </section>
</template>
<script setup>
import PageHeader from '../../components/PageHeader.vue'
import { ref, onMounted } from 'vue'
import request from '../../utils/request'
const rows = ref([]), page = ref(1), total = ref(0), loading = ref(false)
async function load() {
  if (loading.value) return
  loading.value = true
  try {
    const result = await request.get('/operation-logs/page', { params: { pageNum: page.value, pageSize: 20 } })
    rows.value = result.records
    total.value = result.total
  } finally { loading.value = false }
}
onMounted(load)
</script>
<style scoped>
h1 { font-size: 28px; margin: 0 0 8px; }
p { margin: 0; color: var(--muted); }
.panel { padding: 20px; }
.el-pagination { margin-top: 20px; justify-content: flex-end; }
</style>
