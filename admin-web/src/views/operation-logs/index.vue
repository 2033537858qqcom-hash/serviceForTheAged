<template>
  <section>
    <PageHeader eyebrow="审计记录" title="操作日志" description="查看管理员已完成的操作与审计记录">
      <template #actions>
        <el-button :loading="list.loading.value" @click="list.load">刷新记录</el-button>
      </template>
    </PageHeader>
    <div class="panel">
      <DataTable
        :rows="list.rows.value"
        :loading="list.loading.value"
        :error="list.error.value"
        :total="list.total.value"
        :page-num="list.pageNum.value"
        :page-size="list.pageSize.value"
        :page-sizes="[]"
        empty-text="暂无管理操作记录"
        error-text="操作日志暂时未能加载"
        @update:page-num="list.setPage"
        @retry="list.load"
      >
        <el-table-column prop="created_at" label="操作时间" min-width="180" />
        <el-table-column prop="operator_name" label="操作人" min-width="120" />
        <el-table-column prop="action" label="操作动作" min-width="230" />
        <el-table-column prop="target_id" label="对象编号" min-width="180" />
        <el-table-column prop="details" label="操作信息" min-width="250" show-overflow-tooltip />
      </DataTable>
    </div>
  </section>
</template>
<script setup>
import PageHeader from '../../components/PageHeader.vue'
import DataTable from '../../components/DataTable.vue'
import request from '../../utils/request'
import { usePagedQuery } from '../../composables/usePagedQuery.js'

const list = usePagedQuery({
  fetcher: (params, { signal }) => request.get('/operation-logs/page', { params, signal }),
  defaults: {}
})
</script>
<style scoped>
.panel {
  padding: 20px;
}
</style>
