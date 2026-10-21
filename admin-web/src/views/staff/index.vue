<template>
  <div class="staff-container">
    <div class="page-intro"><div><div class="eyebrow">CARE TEAM</div><h1>让合适的人，做好每一项服务</h1><p>核验人员资质，管理技能、工作状态与服务排班。</p></div></div>
    <el-card shadow="never" class="main-card">
      <div class="header-bar flex-between">
        <span style="font-weight: bold; font-size: 16px;">社区养老服务队伍与排班调度</span>
      </div>

      <el-table :data="tableData" v-loading="loading" stripe style="width: 100%">
        <el-table-column label="姓名" width="140">
          <template #default="{ row }">
            <span style="font-weight: bold;">{{ row.user ? row.user.realName : '' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="联系电话" width="140">
          <template #default="{ row }">
            {{ row.user ? row.user.phone : '' }}
          </template>
        </el-table-column>
        <el-table-column prop="profile.serviceArea" label="服务网格" width="140" />
        <el-table-column prop="profile.baseStationName" label="出发站点" min-width="160" show-overflow-tooltip />
        <el-table-column prop="profile.currentStatus" label="工作状态" width="120">
          <template #default="{ row }">
            <el-tag :type="row.profile.currentStatus === 'AVAILABLE' ? 'success' : 'info'">
              {{ row.profile.currentStatus === 'AVAILABLE' ? '接单中' : '休息中' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="profile.auditStatus" label="审核状态" width="110">
          <template #default="{ row }">
            <el-tag :type="row.profile.auditStatus === 'APPROVED' ? 'success' : 'warning'">
              {{ row.profile.auditStatus === 'APPROVED' ? '通过' : '待审' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="专业技能" min-width="200">
          <template #default="{ row }">
            <el-tag v-for="sk in row.skills" :key="sk.id" size="small" style="margin-right: 6px;">
              {{ sk.skillName }}
            </el-tag>
            <span v-if="!row.skills || row.skills.length === 0" style="color: #bfbfbf; font-size: 12px;">暂无资质</span>
          </template>
        </el-table-column>
        <el-table-column label="服务评分" width="110">
          <template #default="{ row }">
            <span style="color: #9b691d; font-weight: bold;">{{ row.profile.priorRating }} 分</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="openManageModal(row)">资质与班次</el-button>
            <el-button
              type="warning"
              link
              @click="toggleWorkStatus(row.profile.id, row.profile.currentStatus)"
            >
              {{ row.profile.currentStatus === 'AVAILABLE' ? '设为休息' : '设为接单' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 技能资质与排班管理对话框 -->
    <el-dialog v-model="manageVisible" title="服务人员技能资质与排班日历" width="700px">
      <div v-if="selectedStaff">
        <el-descriptions title="人员基本信息" :column="2" border>
          <el-descriptions-item label="人员姓名">{{ selectedStaff.user.realName }}</el-descriptions-item>
          <el-descriptions-item label="手机号码">{{ selectedStaff.user.phone }}</el-descriptions-item>
          <el-descriptions-item label="常驻站点">{{ selectedStaff.profile.baseStationName }}</el-descriptions-item>
          <el-descriptions-item label="服务区域">{{ selectedStaff.profile.serviceArea }}</el-descriptions-item>
        </el-descriptions>

        <!-- 技能列表 -->
        <div style="margin-top: 24px;">
          <div class="flex-between" style="margin-bottom: 12px;">
            <span style="font-weight: bold;">专业资质与技能</span>
            <el-button type="primary" plain @click="skillModalVisible = true">+ 录入新资质</el-button>
          </div>
          <el-table :data="selectedStaff.skills || []" size="small" border>
            <el-table-column prop="skillCode" label="代码" width="120" />
            <el-table-column prop="skillName" label="技能名称" width="160" />
            <el-table-column prop="certificateNo" label="证书编号" min-width="160" />
            <el-table-column label="操作" width="90">
              <template #default="{ row }">
                <el-button type="danger" link @click="deleteSkill(row.id)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <!-- 排班班次列表 -->
        <div style="margin-top: 24px;">
          <div class="flex-between" style="margin-bottom: 12px;">
            <span style="font-weight: bold;">有效工作排班班次</span>
            <el-button type="success" plain @click="shiftModalVisible = true">+ 添加排班</el-button>
          </div>
          <el-table :data="selectedStaff.shifts || []" size="small" border max-height="250">
            <el-table-column prop="shiftDate" label="工作日期" width="140" />
            <el-table-column prop="startTime" label="起始时间" width="120" />
            <el-table-column prop="endTime" label="结束时间" width="120" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag size="small" type="success">{{ row.status === 'ACTIVE' ? '有效' : '已取消' }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </el-dialog>

    <!-- 录入新技能资质弹窗 -->
    <el-dialog v-model="skillModalVisible" title="录入专业技能资质" width="450px">
      <el-form :model="skillForm" label-width="100px">
        <el-form-item label="技能分类">
          <el-select v-model="skillForm.skillCode" style="width: 100%;">
            <el-option label="助餐烹饪" value="COOKING" />
            <el-option label="居家保洁" value="CLEANING" />
            <el-option label="跑腿代办" value="ERRAND" />
            <el-option label="助行陪办" value="ESCORT" />
            <el-option label="基础照护护理" value="NURSING" />
          </el-select>
        </el-form-item>
        <el-form-item label="技能名称">
          <el-input v-model="skillForm.skillName" placeholder="如：养老照护资质证书" />
        </el-form-item>
        <el-form-item label="证书编号">
          <el-input v-model="skillForm.certificateNo" placeholder="证书编号或实名备案码" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="skillModalVisible = false">取消</el-button>
        <el-button type="primary" @click="saveSkill">确定录入</el-button>
      </template>
    </el-dialog>

    <!-- 添加排班弹窗 -->
    <el-dialog v-model="shiftModalVisible" title="安排人员工作班次" width="450px">
      <el-form :model="shiftForm" label-width="100px">
        <el-form-item label="排班日期">
          <el-date-picker v-model="shiftForm.shiftDate" type="date" value-format="YYYY-MM-DD" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="上班时间">
          <el-time-picker v-model="shiftForm.startTime" value-format="HH:mm:ss" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="下班时间">
          <el-time-picker v-model="shiftForm.endTime" value-format="HH:mm:ss" style="width: 100%;" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="shiftModalVisible = false">取消</el-button>
        <el-button type="primary" @click="saveShift">保存班次</el-button>
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
const manageVisible = ref(false)
const selectedStaff = ref(null)
const skillModalVisible = ref(false)
const shiftModalVisible = ref(false)

const skillForm = reactive({
  staffId: null,
  skillCode: 'CLEANING',
  skillName: '居家保洁资质',
  certificateNo: ''
})

const shiftForm = reactive({
  staffId: null,
  shiftDate: '',
  startTime: '08:00:00',
  endTime: '18:00:00'
})

const fetchData = () => {
  loading.value = true
  request.get('/staff/page', { params: { pageNum: 1, pageSize: 50 } }).then(res => {
    tableData.value = res.records || []
  }).finally(() => {
    loading.value = false
  })
}

const openManageModal = (row) => {
  selectedStaff.value = row
  manageVisible.value = true
  skillForm.staffId = row.profile.id
  shiftForm.staffId = row.profile.id
}

const toggleWorkStatus = (staffId, currentStatus) => {
  const newStatus = currentStatus === 'AVAILABLE' ? 'RESTING' : 'AVAILABLE'
  request.post(`/staff/${staffId}/status?status=${newStatus}`).then(() => {
    ElMessage.success('工作状态已切换')
    fetchData()
  })
}

const saveSkill = () => {
  request.post('/staff/skill/add', skillForm).then(() => {
    ElMessage.success('资质技能录入成功')
    skillModalVisible.value = false
    refreshSelectedStaff()
  })
}

const deleteSkill = (skillId) => {
  request.delete(`/staff/skill/${skillId}`).then(() => {
    ElMessage.success('资质已删除')
    refreshSelectedStaff()
  })
}

const saveShift = () => {
  if (!shiftForm.shiftDate) {
    ElMessage.warning('请选择排班日期')
    return
  }
  request.post('/staff/shift/add', shiftForm).then(() => {
    ElMessage.success('排班安排成功')
    shiftModalVisible.value = false
    refreshSelectedStaff()
  })
}

const refreshSelectedStaff = () => {
  request.get(`/staff/${selectedStaff.value.profile.id}`).then(res => {
    selectedStaff.value = res
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
