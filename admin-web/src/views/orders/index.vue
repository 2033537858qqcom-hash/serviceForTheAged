<template>
  <div class="orders-container">
    <PageHeader
      eyebrow="服务订单"
      title="每一次服务，都有迹可循"
      description="查看预约进度、协调人员安排，跟进服务完成情况。"
    />
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="list.filters" @submit.prevent="list.search">
        <el-form-item label="订单编号">
          <el-input v-model="list.filters.orderNo" placeholder="输入订单号，回车查询" clearable @clear="list.search" />
        </el-form-item>
        <el-form-item label="订单状态">
          <el-select
            v-model="list.filters.status"
            placeholder="全部状态"
            clearable
            style="width: 160px"
            @change="list.search"
          >
            <el-option v-for="option in orderStatusOptions" :key="option.value" v-bind="option" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" native-type="submit">查询</el-button>
          <el-button icon="Refresh" @click="list.reset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="table-card">
      <DataTable
        :rows="list.rows.value"
        :loading="list.loading.value"
        :error="list.error.value"
        :total="list.total.value"
        :page-num="list.pageNum.value"
        :page-size="list.pageSize.value"
        empty-text="没有符合条件的订单"
        error-text="订单暂时未能加载"
        @update:page-num="list.setPage"
        @update:page-size="list.setPageSize"
        @retry="list.load"
      >
        <el-table-column prop="order.serviceNameSnapshot" label="服务项目 / 订单编号" min-width="215">
          <template #default="{ row }">
            <div class="cell-title">{{ row.order.serviceNameSnapshot }}</div>
            <div class="cell-note">{{ row.order.orderNo }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="elder.name" label="服务老人" min-width="120">
          <template #default="{ row }">
            <span>{{ row.elder ? row.elder.name : '老人' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="order.plannedStartAt" label="预约时间" min-width="170" />
        <el-table-column prop="order.status" label="状态" width="120">
          <template #default="{ row }">
            <StatusTag kind="order" :value="row.order.status" />
          </template>
        </el-table-column>
        <el-table-column label="服务人员" min-width="120">
          <template #default="{ row }">
            <span v-if="row.currentStaff">{{ row.currentStaff.user.realName }}</span>
            <span v-else style="color: var(--muted)">尚未分配</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="145" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="openDetail(row.order.id)">查看</el-button>
            <el-dropdown
              v-if="canReassign(row.order.status) || canCancel(row.order.status) || row.order.status === 'WAIT_CONFIRM'"
              trigger="click"
              class="row-more"
            >
              <el-button link aria-label="更多订单操作" :loading="rowAction.pendingKey.value === row.order.id">
                更多
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-if="canReassign(row.order.status)" @click="openReassign(row)">
                    安排改派
                  </el-dropdown-item>
                  <el-dropdown-item v-if="row.order.status === 'WAIT_CONFIRM'" @click="adminConfirm(row.order.id)">
                    代确认完成
                  </el-dropdown-item>
                  <el-dropdown-item
                    v-if="canCancel(row.order.status)"
                    divided
                    class="is-danger"
                    @click="handleCancel(row.order.id)"
                  >
                    取消订单
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </DataTable>
    </el-card>

    <!-- 订单详情抽屉 -->
    <el-drawer v-model="drawerVisible" title="订单全流程追踪与详情" size="600px" @closed="closeDetail">
      <div v-if="detailData" class="drawer-body">
        <el-descriptions title="基本信息" :column="2" border>
          <el-descriptions-item label="订单号">{{ detailData.order.orderNo }}</el-descriptions-item>
          <el-descriptions-item label="当前状态">
            <StatusTag kind="order" :value="detailData.order.status" />
          </el-descriptions-item>
          <el-descriptions-item label="服务项目">{{ detailData.order.serviceNameSnapshot }}</el-descriptions-item>
          <el-descriptions-item label="预计费用">¥{{ detailData.order.priceSnapshot }}</el-descriptions-item>
          <el-descriptions-item label="费用协调人">{{ detailData.payerName || '下单人' }}</el-descriptions-item>
          <el-descriptions-item label="结算说明" :span="2">{{ detailData.settlementNote }}</el-descriptions-item>
          <el-descriptions-item label="服务对象">
            {{ detailData.elder ? detailData.elder.name : '' }}
          </el-descriptions-item>
          <el-descriptions-item label="预约开始">{{ detailData.order.plannedStartAt }}</el-descriptions-item>
          <el-descriptions-item label="上门地址" :span="2">{{ detailData.order.addressSnapshot }}</el-descriptions-item>
          <el-descriptions-item label="联系人">
            {{ detailData.order.contactNameSnapshot }}
            <MaskedText :value="detailData.order.contactPhoneSnapshot" />
          </el-descriptions-item>
          <el-descriptions-item label="调度轮次">第 {{ detailData.order.dispatchRound }} 轮</el-descriptions-item>
        </el-descriptions>

        <!-- 履约记录 -->
        <div v-if="detailData.serviceRecord" style="margin-top: 24px">
          <el-descriptions title="现场履约记录" :column="1" border>
            <el-descriptions-item label="实际起止时间">
              {{ detailData.serviceRecord.actualStartAt }} ~ {{ detailData.serviceRecord.actualEndAt }}
            </el-descriptions-item>
            <el-descriptions-item label="现场工作总结">
              {{ detailData.serviceRecord.serviceSummary }}
            </el-descriptions-item>
            <el-descriptions-item v-if="photoPaths.length" label="现场照片">
              <PrivatePhoto v-for="source in photoPaths" :key="source" :source="source" />
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 评价反馈 -->
        <div v-if="detailData.serviceReview" style="margin-top: 24px">
          <el-descriptions title="客户评价" :column="1" border>
            <el-descriptions-item label="满意度星级">
              <el-rate :model-value="detailData.serviceReview.rating" disabled show-score text-color="var(--warm)" />
            </el-descriptions-item>
            <el-descriptions-item label="评价内容">
              {{ detailData.serviceReview.content || '无文字评价' }}
              <div
                v-if="detailData.serviceReview.tags"
                style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 8px"
              >
                <el-tag v-for="tag in detailData.serviceReview.tags.split(',')" :key="tag" size="small">
                  {{ tag }}
                </el-tag>
              </div>
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 状态流转日志时间线 -->
        <div style="margin-top: 24px">
          <div style="font-weight: bold; margin-bottom: 16px">状态流转轨迹与日志</div>
          <el-timeline>
            <el-timeline-item v-for="log in detailData.logs" :key="log.id" :timestamp="log.createdAt" type="primary">
              <strong>{{ statusText('order', log.toStatus) }}</strong>
              <div class="text-muted text-sm" style="margin-top: 4px">{{ log.reason }}</div>
            </el-timeline-item>
          </el-timeline>
        </div>
      </div>
    </el-drawer>

    <!-- 改派对话框 -->
    <el-dialog v-model="reassignVisible" title="人工调度改派" width="500px" @closed="reassignFormRef?.clearValidate()">
      <el-form ref="reassignFormRef" :model="reassignForm" :rules="reassignRules" label-width="100px">
        <el-form-item label="改派给人员" prop="newStaffId">
          <StaffSelect v-model="reassignForm.newStaffId" />
        </el-form-item>
        <el-form-item label="改派原因" prop="reason">
          <el-input
            v-model="reassignForm.reason"
            type="textarea"
            maxlength="200"
            show-word-limit
            placeholder="填写人工改派原因留档（至少 4 个字）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reassignVisible = false">取消</el-button>
        <el-button type="primary" :loading="reassign.pending.value" @click="reassign.run">确认改派</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import PageHeader from '../../components/PageHeader.vue'
import DataTable from '../../components/DataTable.vue'
import StatusTag from '../../components/StatusTag.vue'
import MaskedText from '../../components/MaskedText.vue'
import StaffSelect from '../../components/StaffSelect.vue'
import PrivatePhoto from '../../components/PrivatePhoto.vue'
import { ref, reactive, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import request from '../../utils/request'
import { statusOptions, statusText } from '../../utils/presentation.js'
import { usePagedQuery } from '../../composables/usePagedQuery.js'
import { useRowSubmit, useSubmit } from '../../composables/useSubmit.js'
import { promptReason } from '../../utils/confirm.js'
import { required } from '../../utils/validators.js'

const route = useRoute()
const router = useRouter()
const orderStatusOptions = statusOptions('order')
const list = usePagedQuery({
  fetcher: (params, { signal }) => request.get('/orders/page', { params, signal }),
  defaults: { orderNo: '', status: '' },
  pageSize: 10
})

const drawerVisible = ref(false)
const detailData = ref(null)
const photoPaths = computed(() => {
  try {
    const values = JSON.parse(detailData.value?.serviceRecord?.attachmentsJson || '[]')
    return Array.isArray(values) ? values.filter(value => typeof value === 'string').slice(0, 4) : []
  } catch {
    return []
  }
})

const reassignVisible = ref(false)
const reassignFormRef = ref(null)
const reassignForm = reactive({ orderId: null, newStaffId: null, reason: '' })
const reassignRules = {
  newStaffId: [required('请选择改派的服务人员', 'change')],
  reason: [required('请填写改派原因'), { min: 4, max: 200, message: '改派原因为 4 至 200 字', trigger: 'blur' }]
}

const ACTIVE = ['WAIT_DISPATCH', 'WAIT_ACCEPT', 'WAIT_VISIT', 'WAIT_MANUAL']
const canCancel = status => ACTIVE.includes(status)
const canReassign = status => ACTIVE.includes(status)

// 详情抽屉与 ?orderId= 同步：可分享、可后退关闭，同页切换订单也会更新（RT4）
let detailSeq = 0
async function loadDetail(id) {
  const seq = ++detailSeq
  try {
    const data = await request.get(`/orders/${id}`)
    if (seq !== detailSeq) return
    detailData.value = data
    drawerVisible.value = true
  } catch {
    if (seq === detailSeq) closeDetail()
  }
}
function openDetail(id) {
  router.push({ query: { ...route.query, orderId: String(id) } })
}
function closeDetail() {
  drawerVisible.value = false
  if (route.query.orderId) {
    const query = { ...route.query }
    delete query.orderId
    router.replace({ query })
  }
}
watch(
  () => route.query.orderId,
  id => {
    if (id) loadDetail(String(id))
    else drawerVisible.value = false
  },
  { immediate: true }
)

function openReassign(row) {
  Object.assign(reassignForm, { orderId: row.order.id, newStaffId: null, reason: '' })
  reassignVisible.value = true
}

const reassign = useSubmit(async () => {
  const valid = await reassignFormRef.value.validate().catch(() => false)
  if (!valid) return
  try {
    await request.post('/dispatch/reassign', { ...reassignForm, reason: reassignForm.reason.trim() })
    ElMessage.success('人工改派成功')
    reassignVisible.value = false
    list.load()
  } catch {}
})

const rowAction = useRowSubmit(async (orderId, action) => {
  try {
    await action(orderId)
    list.load()
  } catch {}
})

async function adminConfirm(orderId) {
  const note = await promptReason('请输入管理员代为确认的依据与情况说明', '管理员代确认服务完成', {
    confirmText: '确认完成',
    min: 10,
    max: 220,
    placeholder: '填写实际核验方式、结果及代确认原因（10至220字）'
  })
  if (note === null) return
  rowAction.run(orderId, async id => {
    await request.post('/fulfillment/confirm', { orderId: id, note })
    ElMessage.success('代确认完成成功')
  })
}

async function handleCancel(orderId) {
  const reason = await promptReason(
    '取消后服务人员的排班预留会立即释放，居民会收到取消通知。请填写取消原因：',
    '取消订单',
    { confirmText: '确认取消订单', danger: true, max: 100, placeholder: '例如：居民来电要求取消' }
  )
  if (reason === null) return
  rowAction.run(orderId, async id => {
    await request.post(`/orders/${id}/cancel`, null, { params: { reason } })
    ElMessage.success('订单已取消')
  })
}
</script>

<style scoped>
.filter-card {
  margin-bottom: 16px;
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
