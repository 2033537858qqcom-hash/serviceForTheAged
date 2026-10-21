<template>
  <div class="complaints-container">
    <div class="page-intro"><div><div class="eyebrow">COMMUNITY FEEDBACK</div><h1>听见反馈，及时回应</h1><p>跟进服务意见，记录处理结果，让每次反馈有回应。</p></div></div>
    <el-card shadow="never" class="main-card">
      <div class="header-bar flex-between">
        <span style="font-weight: bold; font-size: 16px;">社区服务投诉与意见反馈</span>
        <el-button icon="Refresh" @click="fetchData">刷新</el-button>
      </div>

      <el-table :data="tableData" v-loading="loading" stripe style="width: 100%">
        <el-table-column prop="id" label="编号" width="100" />
        <el-table-column prop="orderId" label="关联订单编号" width="180" />
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
              {{ row.status === 'RESOLVED' ? '已办结答复' : '待处理' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="handleResult" label="社区处置结果" min-width="200" show-overflow-tooltip />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button
              type="primary"
              link
              v-if="row.status !== 'RESOLVED'"
              @click="openHandleModal(row)"
            >
              处理答复
            </el-button>
            <span v-else style="color: #28785b; font-size: 13px;">已办结</span>
          </template>
        </el-table-column>
      </el-table>
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
          <el-input v-model="handleForm.result" type="textarea" :rows="4" placeholder="填写社区调查核实结论及对居民的处理答复..." />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="handleVisible = false">取消</el-button>
        <el-button type="primary" @click="submitHandle">办结并通知</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '../../utils/request'

const loading = ref(false)
const tableData = ref([])
const handleVisible = ref(false)
const currentComplaint = ref(null)

const handleForm = reactive({
  id: null,
  result: ''
})

const fetchData = () => {
  loading.value = true
  request.get('/fulfillment/complaints/page', { params: { pageNum: 1, pageSize: 50 } }).then(res => {
    tableData.value = res.records || []
  }).finally(() => {
    loading.value = false
  })
}

const openHandleModal = (row) => {
  currentComplaint.value = row
  handleForm.id = row.id
  handleForm.result = ''
  handleVisible.value = true
}

const submitHandle = () => {
  if (!handleForm.result.trim()) {
    ElMessage.warning('请填写处理答复内容')
    return
  }
  request.post('/fulfillment/complaint/handle', handleForm).then(() => {
    ElMessage.success('投诉已办结并更新记录')
    handleVisible.value = false
    fetchData()
  })
}

onMounted(() => {
  fetchData()
})
</script>

<style scoped>
.main-card {
  border-radius: 8px;
}

.header-bar {
  margin-bottom: 16px;
}

.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
