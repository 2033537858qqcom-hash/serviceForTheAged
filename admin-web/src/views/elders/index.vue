<template>
  <div class="elders-container">
    <el-card shadow="never" class="main-card">
      <el-tabs v-model="activeTab">
        <!-- Tab 1: 老人档案管理 -->
        <el-tab-pane label="社区老人档案库" name="elders">
          <div class="filter-bar flex-between">
            <el-form :inline="true" :model="elderQuery">
              <el-form-item label="老人姓名">
                <el-input v-model="elderQuery.name" placeholder="输入姓名" clearable />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" icon="Search" @click="fetchElders">查询</el-button>
              </el-form-item>
            </el-form>
            <el-button type="primary" icon="Plus" @click="openElderModal(null)">录入老人档案</el-button>
          </div>

          <el-table :data="eldersData" v-loading="loadingElders" stripe style="width: 100%">
            <el-table-column prop="name" label="姓名" width="120">
              <template #default="{ row }">
                <span style="font-weight: bold;">{{ row.name }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="gender" label="性别" width="80">
              <template #default="{ row }">
                {{ row.gender === 'FEMALE' ? '女' : '男' }}
              </template>
            </el-table-column>
            <el-table-column prop="age" label="年龄" width="80" />
            <el-table-column prop="phone" label="联系电话" width="140" />
            <el-table-column prop="community" label="所属社区" width="140" />
            <el-table-column prop="address" label="居住详细地址" min-width="180" show-overflow-tooltip />
            <el-table-column label="紧急联系人" width="160">
              <template #default="{ row }">
                {{ row.emergencyContact }} ({{ row.emergencyPhone }})
              </template>
            </el-table-column>
            <el-table-column prop="healthNote" label="健康及照护需求" min-width="160" show-overflow-tooltip />
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="openElderModal(row)">编辑</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- Tab 2: 家属代约绑定审核 -->
        <el-tab-pane label="家属代约绑定与授权审核" name="bindings">
          <el-table :data="bindingsData" v-loading="loadingBindings" stripe style="width: 100%">
            <el-table-column label="老人姓名" width="140">
              <template #default="{ row }">
                <strong>{{ row.elder ? row.elder.name : '老人' }}</strong>
              </template>
            </el-table-column>
            <el-table-column label="申请家属" width="160">
              <template #default="{ row }">
                {{ row.familyUser ? (row.familyUser.realName || row.familyUser.username) : '' }}
                <span style="font-size: 12px; color: #8c8c8c;">({{ row.familyUser ? row.familyUser.phone : '' }})</span>
              </template>
            </el-table-column>
            <el-table-column prop="relation" label="亲属关系" width="120">
              <template #default="{ row }">
                <el-tag type="info">{{ row.relation }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="proofMaterials" label="关系说明 / 证明" min-width="180" show-overflow-tooltip />
            <el-table-column prop="createdAt" label="申请时间" width="170" />
            <el-table-column prop="status" label="审核状态" width="120">
              <template #default="{ row }">
                <el-tag :type="row.status === 'APPROVED' ? 'success' : (row.status === 'PENDING' ? 'warning' : 'danger')">
                  {{ row.status === 'APPROVED' ? '已授权通过' : (row.status === 'PENDING' ? '待审核' : (row.status === 'REJECTED' ? '已驳回' : '已撤销')) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <template v-if="row.status === 'PENDING'">
                  <el-button type="success" link size="small" @click="auditBinding(row.id, true)">通过</el-button>
                  <el-button type="danger" link size="small" @click="auditBinding(row.id, false)">驳回</el-button>
                </template>
                <template v-else-if="row.status === 'APPROVED'">
                  <el-button type="danger" link size="small" @click="revokeBinding(row.id)">撤销授权</el-button>
                </template>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 老人档案编辑弹窗 -->
    <el-dialog v-model="elderModalVisible" :title="currentElder.id ? '编辑老人档案' : '录入老人档案'" width="600px">
      <el-form :model="currentElder" label-width="100px">
        <el-form-item label="老人姓名">
          <el-input v-model="currentElder.name" placeholder="真实姓名" />
        </el-form-item>
        <el-form-item label="性别">
          <el-radio-group v-model="currentElder.gender">
            <el-radio label="MALE">男</el-radio>
            <el-radio label="FEMALE">女</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="年龄">
          <el-input-number v-model="currentElder.age" :min="50" :max="120" />
        </el-form-item>
        <el-form-item label="居住地址">
          <el-input v-model="currentElder.address" placeholder="详细居住地址" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="currentElder.phone" placeholder="本人手机号" />
        </el-form-item>
        <el-form-item label="紧急联系人">
          <el-input v-model="currentElder.emergencyContact" placeholder="姓名" />
        </el-form-item>
        <el-form-item label="联系人电话">
          <el-input v-model="currentElder.emergencyPhone" placeholder="手机号" />
        </el-form-item>
        <el-form-item label="健康需求说明">
          <el-input v-model="currentElder.healthNote" type="textarea" placeholder="日常注意事项及需求" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="elderModalVisible = false">取消</el-button>
        <el-button type="primary" @click="saveElder">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '../../utils/request'

const activeTab = ref('elders')
const loadingElders = ref(false)
const eldersData = ref([])
const loadingBindings = ref(false)
const bindingsData = ref([])
const elderModalVisible = ref(false)

const elderQuery = reactive({
  name: '',
  pageNum: 1,
  pageSize: 20
})

const currentElder = reactive({
  id: null,
  name: '',
  gender: 'MALE',
  age: 80,
  phone: '',
  address: '阳光花园社区',
  community: '阳光花园社区',
  emergencyContact: '',
  emergencyPhone: '',
  healthNote: ''
})

const fetchElders = () => {
  loadingElders.value = true
  request.get('/elders/page', { params: elderQuery }).then(res => {
    eldersData.value = res.records || []
  }).finally(() => {
    loadingElders.value = false
  })
}

const fetchBindings = () => {
  loadingBindings.value = true
  request.get('/family-bindings/page', { params: { pageNum: 1, pageSize: 50 } }).then(res => {
    bindingsData.value = res.records || []
  }).finally(() => {
    loadingBindings.value = false
  })
}

const openElderModal = (row) => {
  if (row) {
    Object.assign(currentElder, row)
  } else {
    Object.assign(currentElder, {
      id: null,
      name: '',
      gender: 'MALE',
      age: 80,
      phone: '',
      address: '阳光花园社区',
      community: '阳光花园社区',
      emergencyContact: '',
      emergencyPhone: '',
      healthNote: ''
    })
  }
  elderModalVisible.value = true
}

const saveElder = () => {
  request.post('/elders/save', currentElder).then(() => {
    ElMessage.success('老人档案保存成功')
    elderModalVisible.value = false
    fetchElders()
  })
}

const auditBinding = (bindingId, approve) => {
  const actionText = approve ? '通过' : '驳回'
  ElMessageBox.prompt(`请输入${actionText}审核备注说明`, `审核家属代约申请`, {
    inputValue: approve ? '亲属关系属实，审核通过' : '材料不齐全'
  }).then(({ value }) => {
    request.post('/family-bindings/audit', {
      bindingId,
      approve,
      reason: value
    }).then(() => {
      ElMessage.success(`已${actionText}`)
      fetchBindings()
    })
  })
}

const revokeBinding = (bindingId) => {
  ElMessageBox.confirm('确定撤销此项家属绑定授权吗？撤销后家属将不可继续代约。', '撤销确认', {
    type: 'warning'
  }).then(() => {
    request.post(`/family-bindings/${bindingId}/revoke`).then(() => {
      ElMessage.success('已撤销')
      fetchBindings()
    })
  })
}

onMounted(() => {
  fetchElders()
  fetchBindings()
})
</script>

<style scoped>
.main-card {
  border-radius: 8px;
}

.filter-bar {
  margin-bottom: 16px;
}

.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
