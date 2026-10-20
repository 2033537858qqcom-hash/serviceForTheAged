<template>
  <div class="services-container">
    <div class="page-intro"><div><div class="eyebrow">SERVICE CATALOG</div><h1>把日常所需，送到家门口</h1><p>维护社区服务项目、价格、服务范围与预约说明。</p></div></div>
    <el-card shadow="never" class="main-card">
      <div class="header-bar flex-between">
        <span style="font-weight: bold; font-size: 16px;">养老服务项目配置</span>
        <el-button type="primary" icon="Plus" @click="openModal(null)">新增服务项目</el-button>
      </div>

      <el-table :data="tableData" v-loading="loading" stripe style="width: 100%">
        <el-table-column prop="name" label="项目名称" width="160">
          <template #default="{ row }">
            <span style="font-weight: bold;">{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="服务类别" width="130">
          <template #default="{ row }">
            <el-tag :type="catTagMap[row.category] || 'info'">{{ catTextMap[row.category] || row.category }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="price" label="基准单价" width="120">
          <template #default="{ row }">
            <span style="color: var(--danger); font-weight: bold;">¥{{ row.price }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="durationMinutes" label="预计时长" width="120">
          <template #default="{ row }">
            {{ row.durationMinutes }} 分钟
          </template>
        </el-table-column>
        <el-table-column prop="requiredSkills" label="必需技能资质" width="160">
          <template #default="{ row }">
            <el-tag size="small" type="info" v-if="row.requiredSkills">{{ displaySkills(row.requiredSkills) }}</el-tag>
            <span v-else style="color: var(--muted);">无硬性要求</span>
          </template>
        </el-table-column>
        <el-table-column prop="serviceArea" label="覆盖区域" width="140" />
        <el-table-column prop="description" label="服务介绍" min-width="200" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'ON_SHELF' ? 'success' : 'info'">
              {{ row.status === 'ON_SHELF' ? '上架中' : '已下架' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openModal(row)">编辑</el-button>
            <el-button
              :type="row.status === 'ON_SHELF' ? 'warning' : 'success'"
              link
              size="small"
              @click="toggleStatus(row.id)"
            >
              {{ row.status === 'ON_SHELF' ? '下架' : '上架' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 项目编辑弹窗 -->
    <el-dialog v-model="modalVisible" :title="currentItem.id ? '编辑服务项目' : '新增服务项目'" width="550px">
      <el-form :model="currentItem" label-width="110px">
        <el-form-item label="服务名称">
          <el-input v-model="currentItem.name" placeholder="如：暖心送餐服务" />
        </el-form-item>
        <el-form-item label="服务类别">
          <el-select v-model="currentItem.category" style="width: 100%;">
            <el-option label="助餐送餐" value="MEAL" />
            <el-option label="居家保洁" value="CLEANING" />
            <el-option label="代买代办" value="ERRAND" />
            <el-option label="陪同就医办事" value="ESCORT" />
          </el-select>
        </el-form-item>
        <el-form-item label="基准单价(元)">
          <el-input-number v-model="currentItem.price" :precision="2" :step="5" :min="0" />
        </el-form-item>
        <el-form-item label="预计时长(分钟)">
          <el-input-number v-model="currentItem.durationMinutes" :step="15" :min="15" :max="480" />
        </el-form-item>
        <el-form-item label="所需技能">
          <el-select v-model="selectedSkills" multiple filterable allow-create default-first-option placeholder="选择技能，可输入补充技能" style="width:100%">
            <el-option v-for="(name, code) in skillNames" :key="code" :label="name" :value="code" />
          </el-select>
        </el-form-item>
        <el-form-item label="服务区域">
          <el-input v-model="currentItem.serviceArea" placeholder="阳光花园社区" />
        </el-form-item>
        <el-form-item label="详细介绍">
          <el-input v-model="currentItem.description" type="textarea" placeholder="填写服务详细操作内容与说明" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="modalVisible = false">取消</el-button>
        <el-button type="primary" @click="saveItem">保存项目</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '../../utils/request'

const loading = ref(false)
const tableData = ref([])
const modalVisible = ref(false)
const skillNames = { COOKING: '助餐服务', CLEANING: '居家保洁', ERRAND: '代买代办', ESCORT: '陪同办事', NURSING: '基础照护护理' }
const displaySkills = (value) => String(value).split(',').map(code => skillNames[code.trim()] || code.trim()).join('、')

const catTextMap = {
  'MEAL': '助餐送餐',
  'CLEANING': '居家保洁',
  'ERRAND': '代买代办',
  'ESCORT': '陪同办事'
}

const catTagMap = {
  'MEAL': 'warning',
  'CLEANING': 'primary',
  'ERRAND': 'success',
  'ESCORT': 'info'
}

const currentItem = reactive({
  id: null,
  name: '',
  category: 'MEAL',
  price: 20.00,
  durationMinutes: 60,
  requiredSkills: '',
  serviceArea: '阳光花园社区',
  description: ''
})
const selectedSkills = computed({
  get: () => (currentItem.requiredSkills || '').split(',').map(code => code.trim()).filter(Boolean),
  set: value => { currentItem.requiredSkills = value.join(',') }
})

const fetchData = () => {
  loading.value = true
  request.get('/service-items/page', { params: { pageNum: 1, pageSize: 50 } }).then(res => {
    tableData.value = res.records || []
  }).finally(() => {
    loading.value = false
  })
}

const openModal = (row) => {
  if (row) {
    Object.assign(currentItem, row)
  } else {
    Object.assign(currentItem, {
      id: null,
      name: '',
      category: 'MEAL',
      price: 20.00,
      durationMinutes: 60,
      requiredSkills: '',
      serviceArea: '阳光花园社区',
      description: ''
    })
  }
  modalVisible.value = true
}

const saveItem = () => {
  request.post('/service-items/save', currentItem).then(() => {
    ElMessage.success('服务项目保存成功')
    modalVisible.value = false
    fetchData()
  })
}

const toggleStatus = (id) => {
  request.post(`/service-items/${id}/toggle-status`).then(() => {
    ElMessage.success('状态已切换')
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
