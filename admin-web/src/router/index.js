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
        meta: { title: '工作台', icon: 'Odometer' }
      },
      {
        path: 'orders',
        name: 'Orders',
        component: () => import('../views/orders/index.vue'),
        meta: { title: '服务订单', icon: 'Document' }
      },
      {
        path: 'dispatch',
        name: 'Dispatch',
        component: () => import('../views/dispatch/index.vue'),
        meta: { title: '智能派单', icon: 'Operation' }
      },
      {
        path: 'elders',
        name: 'Elders',
        component: () => import('../views/elders/index.vue'),
        meta: { title: '老人档案', icon: 'User' }
      },
      {
        path: 'services',
        name: 'Services',
        component: () => import('../views/services/index.vue'),
        meta: { title: '服务项目', icon: 'ShoppingBag' }
      },
      {
        path: 'staff',
        name: 'Staff',
        component: () => import('../views/staff/index.vue'),
        meta: { title: '服务人员', icon: 'UserFilled' }
      },
      {
        path: 'complaints',
        name: 'Complaints',
        component: () => import('../views/complaints/index.vue'),
        meta: { title: '反馈处理', icon: 'ChatLineRound' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to) => {
  const token = localStorage.getItem('admin_token')
  if (to.path !== '/login') {
    if (!token) {
      return '/login'
    }
    try {
      const user = JSON.parse(localStorage.getItem('admin_user') || '{}')
      if (user.role && user.role !== 'ADMIN') {
        localStorage.removeItem('admin_token')
        localStorage.removeItem('admin_user')
        return '/login'
      }
    } catch {
      // ignore json parse error
    }
  }
})

export default router
