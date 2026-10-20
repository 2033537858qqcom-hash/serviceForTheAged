<template>
  <div class="dispatch-container">
    <el-card shadow="never" class="alert-card">
      <div class="alert-content">
        <div class="alert-title">🎯 智能派单调度中心与异常处理池</div>
        <div class="alert-desc">
          系统采用“硬约束（技能、服务区域、排班、出行时间）筛选 + 多因素评分（到达便利度D 35% + 服务质量Q 30% + 工作量余量L 25% + 熟悉度F 10%） + 120秒接单倒计时与重派”。
          当自动尝试达到3次上限或无合适候选人员时，订单进入待人工处理队列。
        </div>
      </div>
    </el-card>

    <el-card shadow="never" class="table-card">
      <template #header>
        <div class="flex-between">
          <span style="font-weight: bold; font-size: 16px;">待人工处理 & 待调度订单队列</span>
          <el-button icon="Refresh" @click="fetchData">刷新队列</el-button>
        </div>
      </template>

      <el-table :data="tableData" v-loading="loading" stripe style="width: 100%">
        <el-table-column prop="order.orderNo" label="订单编号" width="180" />
        <el-table-column prop="order.serviceNameSnapshot" label="服务项目" width="140" />
        <el-table-column prop="elder.name" label="服务老人" width="120" />
        <el-table-column prop="order.plannedStartAt" label="预约上门时间" width="170" />
        <el-table-column prop="order.addressSnapshot" label="服务地址" min-width="180" show-overflow-tooltip />
        <el-table-column prop="order.status" label="当前状态" width="130">
          <template #default="{ row }">
            <el-tag :type="row.order.status === 'WAIT_MANUAL' ? 'danger' : 'warning'">
              {{ row.order.status === 'WAIT_MANUAL' ? '待人工处理' : '待派单' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="已尝试轮次" width="120">
          <template #default="{ row }">
            第 {{ row.order.dispatchRound }} 轮
          </template>
        </el-table-column>
        <el-table-column label="调度操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button type="info" link size="small" @click="viewScores(row.order.id)">查看评分与决策解释</el-button>
            <el-button type="primary" link size="small" @click="openAssign(row)">人工指定派单</el-button>
            <el-button type="success" link size="small" @click="autoDispatch(row.order.id)">重试自动派单</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 算法决策与候选人评分明细弹窗 -->
    <el-dialog v-model="scoresVisible" title="算法多因素候选评分与排除解释明细" width="850px">
      <el-alert
        title="Score = 0.35 × D (便利度) + 0.30 × Q (服务质量) + 0.25 × L (工作量余量) + 0.10 × F (熟悉度)"
        type="info"
        :closable="false"
        style="margin-bottom: 16px;"
      />
      <el-table :data="scoresList" stripe style="width: 100%">
        <el-table-column prop="dispatchRound" label="调度轮次" width="90" />
        <el-table-column prop="staffId" label="人员ID" width="100" />
        <el-table-column label="硬约束检验" width="110">
          <template #default="{ row }">
            <el-tag :type="row.isQualified === 1 ? 'success' : 'danger'" size="small">
              {{ row.isQualified === 1 ? '合格候选' : '已排除' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="excludeReason" label="排除原因 / 说明" min-width="160">
          <template #default="{ row }">
            <span v-if="row.isQualified === 0" style="color: #ff4d4f; font-size: 13px;">{{ row.excludeReason }}</span>
            <span v-else style="color: #52c41a; font-size: 13px;">硬约束全部通过</span>
          </template>
        </el-table-column>
        <el-table-column prop="travelMinutes" label="路程耗时" width="90">
          <template #default="{ row }">
            <span>{{ row.travelMinutes }}分钟</span>
          </template>
        </el-table-column>
        <el-table-column label="D (便利)" width="80" prop="metricD" />
        <el-table-column label="Q (质量)" width="80" prop="metricQ" />
        <el-table-column label="L (余量)" width="80" prop="metricL" />
        <el-table-column label="F (熟悉)" width="80" prop="metricF" />
        <el-table-column label="综合得分" width="100" fixed="right">
          <template #default="{ row }">
            <strong style="color: #1890ff; font-size: 15px;">{{ row.totalScore }}</strong>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- 人工指定派单弹窗 -->
    <el-dialog v-model="assignVisible" title="人工指定派单" width="500px">
      <el-form :model="assignForm" label-width="100px">
        <el-form-item label="指定人员">
          <el-select v-model="assignForm.staffId" placeholder="选择服务师傅" style="width: 100%;">
            <el-option
              v-for="s in staffList"
              :key="s.profile.id"
              :label="`${s.user.realName} (${s.profile.serviceArea} - 均分${s.profile.priorRating})`"
              :value="s.profile.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignVisible = false">取消</el-button>
        <el-button type="primary" @click="submitAssign">确认派单</el-button>
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
const scoresVisible = ref(false)
const scoresList = ref([])
const assignVisible = ref(false)
const staffList = ref([])

const assignForm = reactive({
  orderId: null,
  staffId: null
})

const fetchData = () => {
  loading.value = true
  // 查询 WAIT_MANUAL 和 WAIT_DISPATCH 的订单
  request.get('/orders/page', { params: { pageNum: 1, pageSize: 50 } }).then(res => {
    const records = res.records || []
    tableData.value = records.filter(item => ['WAIT_MANUAL', 'WAIT_DISPATCH'].includes(item.order.status))
  }).finally(() => {
    loading.value = false
  })
}

const viewScores = (orderId) => {
  request.get(`/dispatch/scores/${orderId}`).then(res => {
    scoresList.value = res || []
    scoresVisible.value = true
  })
}

const openAssign = (row) => {
  assignForm.orderId = row.order.id
  assignForm.staffId = null
  assignVisible.value = true
  request.get('/staff/page', { params: { pageNum: 1, pageSize: 50, auditStatus: 'APPROVED' } }).then(res => {
    staffList.value = res.records || []
  })
}

const submitAssign = () => {
  if (!assignForm.staffId) {
    ElMessage.warning('请选择目标服务师傅')
    return
  }
  request.post('/dispatch/assign', assignForm).then(() => {
    ElMessage.success('人工指定派单成功')
    assignVisible.value = false
    fetchData()
  })
}

const autoDispatch = (orderId) => {
  request.post('/dispatch/assign', { orderId, staffId: null }).then(() => {
    ElMessage.success('已重新运行自动调度派单算法')
    fetchData()
  })
}

onMounted(() => {
  fetchData()
})
</script>

<style scoped>
.alert-card {
  margin-bottom: 20px;
  background-color: #e6f7ff;
  border: 1px solid #91d5ff;
  border-radius: 8px;
}

.alert-title {
  font-size: 16px;
  font-weight: bold;
  color: #0050b3;
  margin-bottom: 6px;
}

.alert-desc {
  font-size: 13px;
  color: #1890ff;
  line-height: 1.6;
}

.table-card {
  border-radius: 8px;
}

.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
