<template>
  <div class="orders-container">
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="queryForm">
        <el-form-item label="订单编号">
          <el-input v-model="queryForm.orderNo" placeholder="输入订单号" clearable />
        </el-form-item>
        <el-form-item label="订单状态">
          <el-select v-model="queryForm.status" placeholder="全部状态" clearable style="width: 160px;">
            <el-option label="待派单 (WAIT_DISPATCH)" value="WAIT_DISPATCH" />
            <el-option label="待接单 (WAIT_ACCEPT)" value="WAIT_ACCEPT" />
            <el-option label="待上门 (WAIT_VISIT)" value="WAIT_VISIT" />
            <el-option label="服务中 (IN_SERVICE)" value="IN_SERVICE" />
            <el-option label="待确认 (WAIT_CONFIRM)" value="WAIT_CONFIRM" />
            <el-option label="已完成 (COMPLETED)" value="COMPLETED" />
            <el-option label="待人工 (WAIT_MANUAL)" value="WAIT_MANUAL" />
            <el-option label="已取消 (CANCELLED)" value="CANCELLED" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleSearch">查询</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="table-card">
      <el-table :data="tableData" v-loading="loading" stripe style="width: 100%">
        <el-table-column prop="order.orderNo" label="订单号" width="180" />
        <el-table-column prop="order.serviceNameSnapshot" label="服务项目" width="140">
          <template #default="{ row }">
            <span style="font-weight: bold;">{{ row.order.serviceNameSnapshot }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="elder.name" label="服务老人" width="120">
          <template #default="{ row }">
            <span>{{ row.elder ? row.elder.name : '老人' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="order.priceSnapshot" label="费用" width="100">
          <template #default="{ row }">
            <span style="color: #ff4d4f; font-weight: bold;">¥{{ row.order.priceSnapshot }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="order.plannedStartAt" label="预约时间" width="170" />
        <el-table-column prop="order.addressSnapshot" label="服务地址" min-width="180" show-overflow-tooltip />
        <el-table-column prop="order.status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusTagMap[row.order.status] || 'info'">
              {{ statusTextMap[row.order.status] || row.order.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="履约师傅" width="140">
          <template #default="{ row }">
            <span v-if="row.currentStaff">{{ row.currentStaff.user.realName }}</span>
            <span v-else style="color: #8c8c8c;">尚未分配</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openDetail(row.order.id)">详情</el-button>
            <el-button type="warning" link size="small" v-if="canReassign(row.order.status)" @click="openReassign(row)">改派</el-button>
            <el-button type="success" link size="small" v-if="row.order.status === 'WAIT_CONFIRM'" @click="adminConfirm(row.order.id)">代确认</el-button>
            <el-button type="danger" link size="small" v-if="canCancel(row.order.status)" @click="handleCancel(row.order.id)">取消</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-box">
        <el-pagination
          v-model:current-page="queryForm.pageNum"
          v-model:page-size="queryForm.pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="fetchData"
          @current-change="fetchData"
        />
      </div>
    </el-card>

    <!-- 订单详情抽屉 -->
    <el-drawer v-model="drawerVisible" title="订单全流程追踪与详情" size="600px">
      <div v-if="detailData" class="drawer-body">
        <el-descriptions title="基本信息" :column="2" border>
          <el-descriptions-item label="订单号">{{ detailData.order.orderNo }}</el-descriptions-item>
          <el-descriptions-item label="当前状态">
            <el-tag :type="statusTagMap[detailData.order.status] || 'info'">
              {{ statusTextMap[detailData.order.status] || detailData.order.status }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="服务项目">{{ detailData.order.serviceNameSnapshot }}</el-descriptions-item>
          <el-descriptions-item label="预计费用">¥{{ detailData.order.priceSnapshot }}</el-descriptions-item>
          <el-descriptions-item label="服务对象">{{ detailData.elder ? detailData.elder.name : '' }}</el-descriptions-item>
          <el-descriptions-item label="预约开始">{{ detailData.order.plannedStartAt }}</el-descriptions-item>
          <el-descriptions-item label="上门地址" :span="2">{{ detailData.order.addressSnapshot }}</el-descriptions-item>
          <el-descriptions-item label="联系人">{{ detailData.order.contactNameSnapshot }} ({{ detailData.order.contactPhoneSnapshot }})</el-descriptions-item>
          <el-descriptions-item label="调度轮次">第 {{ detailData.order.dispatchRound }} 轮</el-descriptions-item>
        </el-descriptions>

        <!-- 履约记录 -->
        <div v-if="detailData.serviceRecord" style="margin-top: 24px;">
          <el-descriptions title="现场履约记录" :column="1" border>
            <el-descriptions-item label="实际起止时间">
              {{ detailData.serviceRecord.actualStartAt }} ~ {{ detailData.serviceRecord.actualEndAt }}
            </el-descriptions-item>
            <el-descriptions-item label="现场工作总结">
              {{ detailData.serviceRecord.serviceSummary }}
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 评价反馈 -->
        <div v-if="detailData.serviceReview" style="margin-top: 24px;">
          <el-descriptions title="客户评价" :column="1" border>
            <el-descriptions-item label="满意度星级">
              <el-rate :model-value="detailData.serviceReview.rating" disabled show-score text-color="#ff9900" />
            </el-descriptions-item>
            <el-descriptions-item label="评价内容">
              {{ detailData.serviceReview.content || '无文字评价' }}
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 状态流转日志时间线 -->
        <div style="margin-top: 24px;">
          <div style="font-weight: bold; margin-bottom: 16px;">状态流转轨迹与日志</div>
          <el-timeline>
            <el-timeline-item
              v-for="log in detailData.logs"
              :key="log.id"
              :timestamp="log.createdAt"
              type="primary"
            >
              <strong>{{ statusTextMap[log.toStatus] || log.toStatus }}</strong>
              <div style="color: #595959; font-size: 13px; margin-top: 4px;">{{ log.reason }}</div>
            </el-timeline-item>
          </el-timeline>
        </div>
      </div>
    </el-drawer>

    <!-- 改派对话框 -->
    <el-dialog v-model="reassignVisible" title="人工调度改派" width="500px">
      <el-form :model="reassignForm" label-width="100px">
        <el-form-item label="改派给人员">
          <el-select v-model="reassignForm.newStaffId" placeholder="选择目标服务师傅" style="width: 100%;">
            <el-option
              v-for="s in staffList"
              :key="s.profile.id"
              :label="`${s.user.realName} (${s.profile.serviceArea} - ${s.profile.currentStatus === 'AVAILABLE' ? '接单中' : '休息中'})`"
              :value="s.profile.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="改派原因">
          <el-input v-model="reassignForm.reason" type="textarea" placeholder="填写人工改派原因留档" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reassignVisible = false">取消</el-button>
        <el-button type="primary" @click="submitReassign">确认改派</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '../../utils/request'

const loading = ref(false)
const tableData = ref([])
const total = ref(0)
const drawerVisible = ref(false)
const detailData = ref(null)
const reassignVisible = ref(false)
const staffList = ref([])

const queryForm = reactive({
  pageNum: 1,
  pageSize: 10,
  orderNo: '',
  status: ''
})

const reassignForm = reactive({
  orderId: null,
  newStaffId: null,
  reason: '管理员人工协调重派'
})

const statusTextMap = {
  'WAIT_DISPATCH': '待派单',
  'WAIT_ACCEPT': '待接单',
  'WAIT_VISIT': '待上门',
  'IN_SERVICE': '服务中',
  'WAIT_CONFIRM': '待确认',
  'COMPLETED': '已完成',
  'WAIT_MANUAL': '待人工处理',
  'CANCELLED': '已取消'
}

const statusTagMap = {
  'WAIT_DISPATCH': 'warning',
  'WAIT_ACCEPT': 'warning',
  'WAIT_VISIT': 'primary',
  'IN_SERVICE': 'primary',
  'WAIT_CONFIRM': 'warning',
  'COMPLETED': 'success',
  'WAIT_MANUAL': 'danger',
  'CANCELLED': 'info'
}

const canCancel = (status) => ['WAIT_DISPATCH', 'WAIT_ACCEPT', 'WAIT_VISIT', 'WAIT_MANUAL'].includes(status)
const canReassign = (status) => ['WAIT_DISPATCH', 'WAIT_ACCEPT', 'WAIT_VISIT', 'WAIT_MANUAL'].includes(status)

const fetchData = () => {
  loading.value = true
  request.get('/orders/page', { params: queryForm }).then(res => {
    tableData.value = res.records || []
    total.value = res.total || 0
  }).finally(() => {
    loading.value = false
  })
}

const handleSearch = () => {
  queryForm.pageNum = 1
  fetchData()
}

const resetQuery = () => {
  queryForm.orderNo = ''
  queryForm.status = ''
  queryForm.pageNum = 1
  fetchData()
}

const openDetail = (id) => {
  request.get(`/orders/${id}`).then(res => {
    detailData.value = res
    drawerVisible.value = true
  })
}

const openReassign = (row) => {
  reassignForm.orderId = row.order.id
  reassignForm.newStaffId = null
  reassignForm.reason = '管理员人工协调调度'
  reassignVisible.value = true
  loadStaffList()
}

const loadStaffList = () => {
  request.get('/staff/page', { params: { pageNum: 1, pageSize: 50, auditStatus: 'APPROVED' } }).then(res => {
    staffList.value = res.records || []
  })
}

const submitReassign = () => {
  if (!reassignForm.newStaffId) {
    ElMessage.warning('请选择目标服务人员')
    return
  }
  request.post('/dispatch/reassign', reassignForm).then(() => {
    ElMessage.success('人工改派成功')
    reassignVisible.value = false
    fetchData()
  })
}

const adminConfirm = (orderId) => {
  ElMessageBox.prompt('请输入管理员代为确认的依据与情况说明', '管理员代确认服务完成', {
    confirmButtonText: '确认完成',
    cancelButtonText: '取消',
    inputValue: '经社区电话回访核验，老人确认服务已标准完成'
  }).then(({ value }) => {
    request.post('/fulfillment/confirm', { orderId, note: value }).then(() => {
      ElMessage.success('代确认完成成功')
      fetchData()
    })
  })
}

const handleCancel = (orderId) => {
  ElMessageBox.confirm('确定要取消该订单吗？生效的排班预留将立即释放。', '取消订单确认', {
    type: 'warning'
  }).then(() => {
    request.post(`/orders/${orderId}/cancel?reason=管理员后台取消`).then(() => {
      ElMessage.success('订单已取消')
      fetchData()
    })
  })
}

onMounted(() => {
  fetchData()
})
</script>

<style scoped>
.filter-card {
  margin-bottom: 16px;
  border-radius: 8px;
}

.table-card {
  border-radius: 8px;
}

.pagination-box {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

.drawer-body {
  padding: 10px;
}
</style>
