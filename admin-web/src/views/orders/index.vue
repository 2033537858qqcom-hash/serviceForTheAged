<template>
  <div class="orders-container">
    <PageHeader eyebrow="服务订单" title="每一次服务，都有迹可循" description="查看预约进度、协调人员安排，跟进服务完成情况。" />
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="queryForm">
        <el-form-item label="订单编号">
          <el-input v-model="queryForm.orderNo" placeholder="输入订单号" clearable />
        </el-form-item>
        <el-form-item label="订单状态">
          <el-select v-model="queryForm.status" placeholder="全部状态" clearable style="width: 160px;">
            <el-option label="等待安排" value="WAIT_DISPATCH" />
            <el-option label="等待接单" value="WAIT_ACCEPT" />
            <el-option label="待上门" value="WAIT_VISIT" />
            <el-option label="服务中" value="IN_SERVICE" />
            <el-option label="待确认" value="WAIT_CONFIRM" />
            <el-option label="已完成" value="COMPLETED" />
            <el-option label="需要协调" value="WAIT_MANUAL" />
            <el-option label="已取消" value="CANCELLED" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleSearch">查询</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="table-card">
      <el-skeleton :loading="loading && !tableData.length" animated :rows="6">
      <template #default>
      <el-table :data="tableData" v-loading="loading && tableData.length > 0" stripe style="width: 100%">
        <el-table-column prop="order.serviceNameSnapshot" label="服务项目 / 订单编号" min-width="215">
          <template #default="{ row }">
            <div class="cell-title">{{ row.order.serviceNameSnapshot }}</div>
            <div class="cell-note">{{ row.order.orderNo }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="elder.name" label="服务老人" width="120">
          <template #default="{ row }">
            <span>{{ row.elder ? row.elder.name : '老人' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="order.plannedStartAt" label="预约时间" width="170" />
        <el-table-column prop="order.status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusTagMap[row.order.status] || 'info'">
              {{ statusTextMap[row.order.status] || row.order.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="服务人员" width="120">
          <template #default="{ row }">
            <span v-if="row.currentStaff">{{ row.currentStaff.user.realName }}</span>
            <span v-else style="color: var(--muted);">尚未分配</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="145" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="openDetail(row.order.id)">查看</el-button>
            <el-dropdown v-if="canReassign(row.order.status) || canCancel(row.order.status) || row.order.status === 'WAIT_CONFIRM'" trigger="click" class="row-more">
              <el-button link aria-label="更多订单操作">更多</el-button>
              <template #dropdown><el-dropdown-menu>
                <el-dropdown-item v-if="canReassign(row.order.status)" @click="openReassign(row)">安排改派</el-dropdown-item>
                <el-dropdown-item v-if="row.order.status === 'WAIT_CONFIRM'" @click="adminConfirm(row.order.id)">代确认完成</el-dropdown-item>
                <el-dropdown-item v-if="canCancel(row.order.status)" @click="handleCancel(row.order.id)">取消订单</el-dropdown-item>
              </el-dropdown-menu></template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>
      </template>
      </el-skeleton>

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
          <el-descriptions-item label="费用协调人">{{ detailData.payerName || '下单人' }}</el-descriptions-item>
          <el-descriptions-item label="结算说明" :span="2">{{ detailData.settlementNote }}</el-descriptions-item>
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
            <el-descriptions-item v-if="photoPaths.length" label="现场照片"><PrivatePhoto v-for="source in photoPaths" :key="source" :source="source" /></el-descriptions-item>
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
              <div style="color: #54645a; font-size: 13px; margin-top: 4px;">{{ log.reason }}</div>
            </el-timeline-item>
          </el-timeline>
        </div>
      </div>
    </el-drawer>

    <!-- 改派对话框 -->
    <el-dialog v-model="reassignVisible" title="人工调度改派" width="500px">
      <el-form :model="reassignForm" label-width="100px">
        <el-form-item label="改派给人员">
          <el-select v-model="reassignForm.newStaffId" placeholder="选择目标服务人员" style="width: 100%;">
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
import PageHeader from '../../components/PageHeader.vue'
import { ref, reactive, onMounted, computed } from 'vue'
import PrivatePhoto from '../../components/PrivatePhoto.vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '../../utils/request'

const route = useRoute()
const loading = ref(false)
const tableData = ref([])
const total = ref(0)
const drawerVisible = ref(false)
const detailData = ref(null)
const photoPaths = computed(() => {
  try {
    const values = JSON.parse(detailData.value?.serviceRecord?.attachmentsJson || '[]')
    return Array.isArray(values) ? values.filter(value => typeof value === 'string').slice(0, 4) : []
  } catch { return [] }
})
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
    total.value = Number(res.total || 0)
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
    inputValue: '',
    inputPlaceholder: '填写实际核验方式、结果及代确认原因（10至220字）',
    inputValidator: value => Boolean(value && value.trim().length >= 10 && value.length <= 220) || '请填写10至220字的真实核验依据'
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
  if (route.query.orderId) openDetail(String(route.query.orderId))
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
