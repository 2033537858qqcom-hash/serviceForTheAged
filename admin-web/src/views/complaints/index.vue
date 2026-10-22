<template>
  <div class="complaints-container">
    <PageHeader eyebrow="反馈处理" title="听见反馈，及时回应" description="跟进服务意见，记录处理结果，让每次反馈有回应。" />
    <el-card shadow="never" class="main-card">
      <div class="header-bar flex-between">
        <span style="font-weight: bold; font-size: 16px;">社区服务投诉与意见反馈</span>
        <div class="feedback-tools"><el-select v-model="statusFilter" placeholder="全部状态" clearable @change="pageNum = 1; fetchData()"><el-option label="待受理" value="PENDING" /><el-option label="处理中" value="PROCESSING" /><el-option label="已处理" value="RESOLVED" /></el-select><el-button icon="Refresh" @click="fetchData">刷新</el-button></div>
      </div>

      <el-skeleton :loading="loading && !tableData.length" animated :rows="6">
      <template #default>
      <el-table :data="tableData" v-loading="loading && tableData.length > 0" stripe style="width: 100%">
        <el-table-column prop="id" label="编号" width="100" />
        <el-table-column prop="orderId" label="关联订单编号" width="180">
          <template #default="{ row }">
            <span v-if="row.orderId && row.orderId !== '0'">{{ row.orderId }}</span>
            <el-tag v-else size="small" type="info">平台/社区通用建议</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="complaintTitle" label="投诉主题" width="180">
          <template #default="{ row }">
            <span style="font-weight: bold;">{{ row.complaintTitle }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="complaintContent" label="反馈详情" min-width="220" show-overflow-tooltip />
        <el-table-column prop="createdAt" label="提交时间" width="170" />
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="row.status === 'RESOLVED' ? 'success' : 'warning'">
              {{ statusText[row.status] || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="handleResult" label="社区处置结果" min-width="200" show-overflow-tooltip />
        <el-table-column label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'PENDING'" type="primary" link :loading="startingId === row.id" @click="startHandle(row)">受理</el-button>
            <el-button
              type="primary"
              link
              v-if="['PENDING', 'PROCESSING'].includes(row.status)"
              @click="openHandleModal(row)"
            >
              处理答复
            </el-button>
            <span v-else style="color: #28785b; font-size: 13px;">{{ statusText[row.status] || row.status }}</span>
          </template>
        </el-table-column>
      </el-table>
      </template>
      </el-skeleton>
      <el-pagination v-model:current-page="pageNum" :page-size="20" :total="total" layout="prev, pager, next, total" @current-change="fetchData" />
    </el-card>

    <!-- 处理投诉弹窗 -->
    <el-dialog v-model="handleVisible" title="处理并答复投诉" width="500px">
      <el-form :model="handleForm" label-width="100px">
        <el-form-item label="投诉主题">
          <span>{{ currentComplaint ? currentComplaint.complaintTitle : '' }}</span>
        </el-form-item>
        <el-form-item label="投诉内容">
          <span style="color: #54645a;">{{ currentComplaint ? currentComplaint.complaintContent : '' }}</span>
        </el-form-item>
        <el-form-item label="处理答复">
          <el-input v-model="handleForm.result" type="textarea" :rows="4" maxlength="4000" show-word-limit placeholder="填写社区调查核实结论及对居民的处理答复..." />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="handleVisible = false">取消</el-button>
        <el-button type="primary" :loading="handling" @click="submitHandle">办结并保存答复</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import PageHeader from '../../components/PageHeader.vue'
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '../../utils/request'

const loading = ref(false)
const tableData = ref([])
const handleVisible = ref(false)
const currentComplaint = ref(null)
const statusFilter = ref('')
const pageNum = ref(1)
const total = ref(0)
const startingId = ref(null)
const handling = ref(false)
const statusText = { PENDING: '待受理', PROCESSING: '处理中', RESOLVED: '已处理', REJECTED: '已关闭' }

const handleForm = reactive({
  id: null,
  result: ''
})

const fetchData = () => {
  loading.value = true
  request.get('/fulfillment/complaints/page', { params: { pageNum: pageNum.value, pageSize: 20, status: statusFilter.value || undefined } }).then(res => {
    tableData.value = res.records || []
    total.value = res.total || 0
  }).finally(() => {
    loading.value = false
  })
}

const startHandle = async (row) => {
  if (startingId.value) return
  startingId.value = row.id
  try {
    await request.post('/fulfillment/complaint/start', { id: row.id })
    ElMessage.success('已受理，居民可查看处理进度')
    fetchData()
  } finally { startingId.value = null }
}

const openHandleModal = (row) => {
  currentComplaint.value = row
  handleForm.id = row.id
  handleForm.result = ''
  handleVisible.value = true
}

const submitHandle = () => {
  if (handling.value) return
  if (!handleForm.result.trim()) {
    ElMessage.warning('请填写处理答复内容')
    return
  }
  handling.value = true
  request.post('/fulfillment/complaint/handle', { ...handleForm, result: handleForm.result.trim() }).then(() => {
    ElMessage.success('投诉已办结并更新记录')
    handleVisible.value = false
    fetchData()
  }).finally(() => { handling.value = false })
}

onMounted(() => {
  fetchData()
})
</script>

<style scoped>
.main-card {
  border-radius: 8px;
}
.feedback-tools { display: flex; align-items: center; gap: 12px; }
.feedback-tools .el-select { width: 150px; }
.el-pagination { margin-top: 20px; justify-content: flex-end; }

.header-bar {
  margin-bottom: 16px;
}

.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
