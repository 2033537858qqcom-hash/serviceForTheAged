import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/login/index.vue')
  },
  {
    path: '/',
    component: () => import('../views/layout/index.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('../views/dashboard/index.vue'),
        meta: { title: '数据看板', icon: 'Odometer' }
      },
      {
        path: 'orders',
        name: 'Orders',
        component: () => import('../views/orders/index.vue'),
        meta: { title: '订单综合管理', icon: 'Document' }
      },
      {
        path: 'dispatch',
        name: 'Dispatch',
        component: () => import('../views/dispatch/index.vue'),
        meta: { title: '智能调度与待人工队列', icon: 'Operation' }
      },
      {
        path: 'elders',
        name: 'Elders',
        component: () => import('../views/elders/index.vue'),
        meta: { title: '老人档案与家属绑定', icon: 'User' }
      },
      {
        path: 'services',
        name: 'Services',
        component: () => import('../views/services/index.vue'),
        meta: { title: '养老服务项目管理', icon: 'ShoppingBag' }
      },
      {
        path: 'staff',
        name: 'Staff',
        component: () => import('../views/staff/index.vue'),
        meta: { title: '人员资质与排班管理', icon: 'UserFilled' }
      },
      {
        path: 'complaints',
        name: 'Complaints',
        component: () => import('../views/complaints/index.vue'),
        meta: { title: '服务投诉与反馈处理', icon: 'ChatLineRound' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('admin_token')
  if (to.path !== '/login' && !token) {
    next('/login')
  } else {
    next()
  }
})

export default router
