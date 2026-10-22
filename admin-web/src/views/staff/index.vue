<template>
  <div class="staff-container">
    <PageHeader
      eyebrow="服务人员"
      title="让合适的人，做好每一项服务"
      description="核验人员资质，管理技能、工作状态与服务排班。"
    />
    <el-card shadow="never" class="main-card">
      <div class="header-bar toolbar-end">
        <el-form :inline="true" :model="list.filters" class="staff-filter" @submit.prevent="list.search">
          <el-input
            v-model="list.filters.name"
            placeholder="输入姓名，回车搜索"
            clearable
            style="width: 200px"
            @clear="list.search"
          />
          <el-button icon="Search" native-type="submit">搜索</el-button>
        </el-form>
      </div>

      <DataTable
        :rows="list.rows.value"
        :loading="list.loading.value"
        :error="list.error.value"
        :total="list.total.value"
        :page-num="list.pageNum.value"
        :page-size="list.pageSize.value"
        empty-text="还没有符合条件的服务人员"
        error-text="服务人员暂时未能加载"
        @update:page-num="list.setPage"
        @update:page-size="list.setPageSize"
        @retry="list.load"
      >
        <el-table-column label="姓名" width="140">
          <template #default="{ row }">
            <span style="font-weight: bold">{{ row.user ? row.user.realName : '' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="联系电话" width="170">
          <template #default="{ row }"><MaskedText :value="row.user?.phone || ''" /></template>
        </el-table-column>
        <el-table-column prop="profile.serviceArea" label="服务网格" width="140" />
        <el-table-column prop="profile.baseStationName" label="出发站点" min-width="160" show-overflow-tooltip />
        <el-table-column prop="profile.currentStatus" label="工作状态" width="120">
          <template #default="{ row }">
            <StatusTag kind="staffWork" :value="row.profile.currentStatus" />
          </template>
        </el-table-column>
        <el-table-column prop="profile.auditStatus" label="审核状态" width="110">
          <template #default="{ row }">
            <StatusTag kind="staffAudit" :value="row.profile.auditStatus" />
          </template>
        </el-table-column>
        <el-table-column label="专业技能" min-width="200">
          <template #default="{ row }">
            <el-tag v-for="sk in row.skills" :key="sk.id" size="small" style="margin-right: 6px">
              {{ sk.skillName }}
            </el-tag>
            <span v-if="!row.skills || row.skills.length === 0" class="text-muted text-xs">暂无资质</span>
          </template>
        </el-table-column>
        <el-table-column label="服务评分" width="110">
          <template #default="{ row }">
            <span class="text-warm text-strong">{{ row.profile.priorRating }} 分</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="openManageModal(row)">资质与班次</el-button>
            <el-button
              link
              :loading="statusAction.pendingKey.value === row.profile.id"
              :disabled="statusAction.pendingKey.value !== null && statusAction.pendingKey.value !== row.profile.id"
              @click="toggleWorkStatus(row)"
            >
              {{ row.profile.currentStatus === 'AVAILABLE' ? '设为休息' : '设为接单' }}
            </el-button>
          </template>
        </el-table-column>
      </DataTable>
    </el-card>

    <!-- 技能资质与排班管理对话框 -->
    <el-dialog v-model="manageVisible" title="服务人员技能资质与排班日历" width="700px">
      <div v-if="selectedStaff">
        <el-descriptions title="人员基本信息" :column="2" border>
          <el-descriptions-item label="人员姓名">{{ selectedStaff.user.realName }}</el-descriptions-item>
          <el-descriptions-item label="手机号码">
            <MaskedText :value="selectedStaff.user.phone || ''" />
          </el-descriptions-item>
          <el-descriptions-item label="常驻站点">{{ selectedStaff.profile.baseStationName }}</el-descriptions-item>
          <el-descriptions-item label="服务区域">{{ selectedStaff.profile.serviceArea }}</el-descriptions-item>
        </el-descriptions>

        <!-- 技能列表 -->
        <div style="margin-top: 24px">
          <div class="flex-between" style="margin-bottom: 12px">
            <span style="font-weight: bold">专业资质与技能</span>
            <el-button type="primary" plain @click="openSkillModal">+ 录入新资质</el-button>
          </div>
          <el-table :data="selectedStaff.skills || []" size="small" border empty-text="暂无资质">
            <el-table-column prop="skillCode" label="代码" width="120" />
            <el-table-column prop="skillName" label="技能名称" width="160" />
            <el-table-column prop="certificateNo" label="证书编号" min-width="160" />
            <el-table-column label="操作" width="90">
              <template #default="{ row }">
                <el-button
                  type="danger"
                  link
                  :loading="skillAction.pendingKey.value === row.id"
                  @click="deleteSkill(row)"
                >
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <!-- 排班班次列表 -->
        <div style="margin-top: 24px">
          <div class="flex-between" style="margin-bottom: 12px">
            <span style="font-weight: bold">有效工作排班班次</span>
            <el-button type="primary" plain @click="openShiftModal">+ 添加排班</el-button>
          </div>
          <el-table :data="selectedStaff.shifts || []" size="small" border max-height="250" empty-text="暂无排班">
            <el-table-column prop="shiftDate" label="工作日期" width="140" />
            <el-table-column prop="startTime" label="起始时间" width="120" />
            <el-table-column prop="endTime" label="结束时间" width="120" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <StatusTag kind="shift" :value="row.status" size="small" />
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </el-dialog>

    <!-- 录入新技能资质弹窗 -->
    <el-dialog
      v-model="skillModalVisible"
      title="录入专业技能资质"
      width="450px"
      @closed="skillFormRef?.clearValidate()"
    >
      <el-form ref="skillFormRef" :model="skillForm" :rules="skillRules" label-width="100px">
        <el-form-item label="技能分类" prop="skillCode">
          <el-select v-model="skillForm.skillCode" style="width: 100%" @change="onSkillCodeChange">
            <el-option v-for="(name, code) in SKILLS" :key="code" :label="name" :value="code" />
          </el-select>
        </el-form-item>
        <el-form-item label="技能名称" prop="skillName">
          <el-input v-model="skillForm.skillName" placeholder="如：养老照护资质证书" maxlength="64" />
        </el-form-item>
        <el-form-item label="证书编号" prop="certificateNo">
          <el-input v-model="skillForm.certificateNo" placeholder="证书编号或实名备案码" maxlength="64" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="skillModalVisible = false">取消</el-button>
        <el-button type="primary" :loading="saveSkill.pending.value" @click="saveSkill.run">确定录入</el-button>
      </template>
    </el-dialog>

    <!-- 添加排班弹窗 -->
    <el-dialog
      v-model="shiftModalVisible"
      title="安排人员工作班次"
      width="450px"
      @closed="shiftFormRef?.clearValidate()"
    >
      <el-form ref="shiftFormRef" :model="shiftForm" :rules="shiftRules" label-width="100px">
        <el-form-item label="排班日期" prop="shiftDate">
          <el-date-picker
            v-model="shiftForm.shiftDate"
            type="date"
            value-format="YYYY-MM-DD"
            :disabled-date="isPastDate"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="上班时间" prop="startTime">
          <el-time-picker v-model="shiftForm.startTime" value-format="HH:mm:ss" style="width: 100%" />
        </el-form-item>
        <el-form-item label="下班时间" prop="endTime">
          <el-time-picker v-model="shiftForm.endTime" value-format="HH:mm:ss" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="shiftModalVisible = false">取消</el-button>
        <el-button type="primary" :loading="saveShift.pending.value" @click="saveShift.run">保存班次</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import PageHeader from '../../components/PageHeader.vue'
import DataTable from '../../components/DataTable.vue'
import StatusTag from '../../components/StatusTag.vue'
import MaskedText from '../../components/MaskedText.vue'
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import request from '../../utils/request'
import { SKILLS } from '../../utils/presentation.js'
import { usePagedQuery } from '../../composables/usePagedQuery.js'
import { useRowSubmit, useSubmit } from '../../composables/useSubmit.js'
import { confirmDanger } from '../../utils/confirm.js'
import { isTimeAfter, maxLength, required } from '../../utils/validators.js'

const list = usePagedQuery({
  fetcher: (params, { signal }) => request.get('/staff/page', { params, signal }),
  defaults: { name: '' }
})

const manageVisible = ref(false)
const selectedStaff = ref(null)
const skillModalVisible = ref(false)
const shiftModalVisible = ref(false)
const skillFormRef = ref(null)
const shiftFormRef = ref(null)

const skillForm = reactive({ staffId: null, skillCode: 'CLEANING', skillName: '居家保洁资质', certificateNo: '' })
const skillRules = {
  skillCode: [required('请选择技能分类', 'change')],
  skillName: [required('请填写技能名称'), maxLength(64, '技能名称')],
  certificateNo: [maxLength(64, '证书编号')]
}
const shiftForm = reactive({ staffId: null, shiftDate: '', startTime: '08:00:00', endTime: '18:00:00' })
const shiftRules = {
  shiftDate: [required('请选择排班日期', 'change')],
  startTime: [required('请选择上班时间', 'change')],
  endTime: [
    required('请选择下班时间', 'change'),
    {
      trigger: 'change',
      validator: (_rule, value, callback) =>
        isTimeAfter(value, shiftForm.startTime) ? callback() : callback(new Error('下班时间需晚于上班时间'))
    }
  ]
}
const isPastDate = date => date.getTime() < new Date().setHours(0, 0, 0, 0)

function openManageModal(row) {
  selectedStaff.value = row
  manageVisible.value = true
  skillForm.staffId = row.profile.id
  shiftForm.staffId = row.profile.id
}

function openSkillModal() {
  Object.assign(skillForm, { skillCode: 'CLEANING', skillName: '居家保洁资质', certificateNo: '' })
  skillModalVisible.value = true
}
function onSkillCodeChange(code) {
  if (!skillForm.skillName || Object.values(SKILLS).some(name => skillForm.skillName.startsWith(name))) {
    skillForm.skillName = `${SKILLS[code]}资质`
  }
}
function openShiftModal() {
  Object.assign(shiftForm, { shiftDate: '', startTime: '08:00:00', endTime: '18:00:00' })
  shiftModalVisible.value = true
}

const statusAction = useRowSubmit(async (staffId, nextStatus) => {
  try {
    await request.post(`/staff/${staffId}/status`, null, { params: { status: nextStatus } })
    ElMessage.success(nextStatus === 'AVAILABLE' ? '已设为接单中' : '已设为休息，不再参与派单')
    list.load()
  } catch {}
})

async function toggleWorkStatus(row) {
  const toRest = row.profile.currentStatus === 'AVAILABLE'
  if (toRest) {
    const ok = await confirmDanger(
      `${row.user?.realName || '该人员'}设为休息后将不再参与自动派单，已接的订单不受影响。`,
      '设为休息',
      '确认设为休息'
    )
    if (!ok) return
  }
  statusAction.run(row.profile.id, toRest ? 'RESTING' : 'AVAILABLE')
}

const saveSkill = useSubmit(async () => {
  const valid = await skillFormRef.value.validate().catch(() => false)
  if (!valid) return
  try {
    await request.post('/staff/skill/add', { ...skillForm, skillName: skillForm.skillName.trim() })
    ElMessage.success('资质技能录入成功')
    skillModalVisible.value = false
    refreshSelectedStaff()
  } catch {}
})

const skillAction = useRowSubmit(async skillId => {
  try {
    await request.delete(`/staff/skill/${skillId}`)
    ElMessage.success('资质已删除')
    refreshSelectedStaff()
  } catch {}
})

async function deleteSkill(skill) {
  const ok = await confirmDanger(
    `删除「${skill.skillName}」后，需要该技能的服务将不再派给这位人员。此操作不可撤销。`,
    '删除资质',
    '确认删除'
  )
  if (ok) skillAction.run(skill.id)
}

const saveShift = useSubmit(async () => {
  const valid = await shiftFormRef.value.validate().catch(() => false)
  if (!valid) return
  try {
    await request.post('/staff/shift/add', shiftForm)
    ElMessage.success('排班安排成功')
    shiftModalVisible.value = false
    refreshSelectedStaff()
  } catch {}
})

async function refreshSelectedStaff() {
  try {
    selectedStaff.value = await request.get(`/staff/${selectedStaff.value.profile.id}`)
  } catch {}
  list.load()
}
</script>

<style scoped>
.header-bar {
  margin-bottom: 16px;
}

.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.staff-filter {
  display: flex;
  gap: 8px;
}
</style>
