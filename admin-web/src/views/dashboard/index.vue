<template>
  <div class="dashboard-container" v-loading="loading">
    <!-- 指标卡片行 -->
    <el-row :gutter="16" class="metric-row">
      <el-col :span="4">
        <el-card shadow="hover" class="metric-card">
          <div class="metric-title">累计服务订单</div>
          <div class="metric-value">{{ stat.totalOrders || 0 }} <span class="unit">笔</span></div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card shadow="hover" class="metric-card border-success">
          <div class="metric-title">圆满完成订单</div>
          <div class="metric-value text-success">{{ stat.completedOrders || 0 }} <span class="unit">笔</span></div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card shadow="hover" class="metric-card border-warning">
          <div class="metric-title">待派单 / 待人工</div>
          <div class="metric-value text-warning">{{ stat.waitingDispatchOrders || 0 }} <span class="unit">笔</span></div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card shadow="hover" class="metric-card border-primary">
          <div class="metric-title">正在履约中</div>
          <div class="metric-value text-primary">{{ stat.inServiceOrders || 0 }} <span class="unit">笔</span></div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card shadow="hover" class="metric-card">
          <div class="metric-title">登记在册老人</div>
          <div class="metric-value">{{ stat.totalElders || 0 }} <span class="unit">人</span></div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card shadow="hover" class="metric-card">
          <div class="metric-title">审核通过服务师傅</div>
          <div class="metric-value">{{ stat.totalStaff || 0 }} <span class="unit">人</span></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表行 -->
    <el-row :gutter="16" class="chart-row">
      <el-col :span="12">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <span class="card-header-title">服务需求类别分布</span>
          </template>
          <div ref="pieChartRef" class="chart-box"></div>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <span class="card-header-title">近7天订单需求趋势</span>
          </template>
          <div ref="lineChartRef" class="chart-box"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 服务人员工作量与评分排行 -->
    <el-card shadow="never" class="table-card">
      <template #header>
        <span class="card-header-title">社区服务人员实时工作负载与评分</span>
      </template>
      <el-table :data="stat.staffWorkloadList || []" stripe style="width: 100%">
        <el-table-column prop="staffId" label="人员工号" width="120" />
        <el-table-column prop="staffName" label="工作人员姓名" width="160">
          <template #default="{ row }">
            <span style="font-weight: bold;">{{ row.staffName }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="当前状态" width="140">
          <template #default="{ row }">
            <el-tag :type="row.status === 'AVAILABLE' ? 'success' : (row.status === 'BUSY' ? 'warning' : 'info')">
              {{ row.status === 'AVAILABLE' ? '接单中' : (row.status === 'BUSY' ? '服务中' : '休息中') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="totalOrders" label="累计完成订单" width="160">
          <template #default="{ row }">
            <el-tag type="info">{{ row.totalOrders }} 单</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="rating" label="贝叶斯平滑历史均分" min-width="200">
          <template #default="{ row }">
            <el-rate :model-value="Number(row.rating)" disabled show-score text-color="#ff9900" score-template="{value}分" />
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import request from '../../utils/request'

const loading = ref(false)
const stat = ref({})
const pieChartRef = ref(null)
const lineChartRef = ref(null)

let pieChart = null
let lineChart = null

const fetchStat = () => {
  loading.value = true
  request.get('/stats/dashboard').then(data => {
    stat.value = data || {}
    nextTick(() => {
      renderCharts(data)
    })
  }).finally(() => {
    loading.value = false
  })
}

const renderCharts = (data) => {
  if (pieChartRef.value) {
    if (!pieChart) pieChart = echarts.init(pieChartRef.value)
    pieChart.setOption({
      tooltip: { trigger: 'item' },
      legend: { bottom: '0%' },
      series: [
        {
          name: '服务项目',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          data: (data && data.categoryDistribution) || [
            { name: '助餐送餐', value: 12 },
            { name: '居家保洁', value: 8 },
            { name: '代买代办', value: 6 },
            { name: '陪同办事', value: 4 }
          ]
        }
      ]
    })
  }

  if (lineChartRef.value) {
    if (!lineChart) lineChart = echarts.init(lineChartRef.value)
    const trend = (data && data.recentOrdersTrend) || []
    const dates = trend.map(t => t.date)
    const counts = trend.map(t => t.count)

    lineChart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', boundaryGap: false, data: dates },
      yAxis: { type: 'value', minInterval: 1 },
      series: [
        {
          name: '订单量',
          type: 'line',
          smooth: true,
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(24, 144, 255, 0.4)' },
              { offset: 1, color: 'rgba(24, 144, 255, 0.05)' }
            ])
          },
          lineStyle: { color: '#1890ff', width: 3 },
          itemStyle: { color: '#1890ff' },
          data: counts
        }
      ]
    })
  }
}

onMounted(() => {
  fetchStat()
  window.addEventListener('resize', () => {
    pieChart && pieChart.resize()
    lineChart && lineChart.resize()
  })
})
</script>

<style scoped>
.metric-row {
  margin-bottom: 20px;
}

.metric-card {
  border-radius: 8px;
}

.metric-title {
  font-size: 13px;
  color: #8c8c8c;
  margin-bottom: 8px;
}

.metric-value {
  font-size: 26px;
  font-weight: bold;
  color: #262626;
}

.unit {
  font-size: 14px;
  font-weight: normal;
  color: #8c8c8c;
}

.text-success { color: #52c41a !important; }
.text-warning { color: #faad14 !important; }
.text-primary { color: #1890ff !important; }

.chart-row {
  margin-bottom: 20px;
}

.chart-card {
  border-radius: 8px;
}

.card-header-title {
  font-size: 15px;
  font-weight: bold;
}

.chart-box {
  height: 300px;
}

.table-card {
  border-radius: 8px;
}
</style>
