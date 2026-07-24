// src/router/index.js
import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'login',
    component: () => import('@/pages/LoginPage.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    component: () => import('@/components/common/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/pages/DashboardPage.vue'),
        meta: { title: '持仓' }
      },
      {
        path: 'positions',
        name: 'positions',
        component: () => import('@/pages/PositionsPage.vue'),
        meta: { title: '仓位' }
      },
      {
        path: 'trends',
        name: 'trends',
        component: () => import('@/pages/TrendsPage.vue'),
        meta: { title: '趋势' }
      },
      {
        path: 'trade',
        name: 'trade',
        component: () => import('@/pages/TradePage.vue'),
        meta: { title: '交易' }
      },
      {
        path: 'fund',
        name: 'fund',
        component: () => import('@/pages/FundPage.vue'),
        meta: { title: '资金' }
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/pages/SettingsPage.vue'),
        meta: { title: '设置' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// 路由守卫
router.beforeEach((to, from, next) => {
  const isAuthenticated = localStorage.getItem('auth') === 'true'
  if (to.meta.requiresAuth && !isAuthenticated) {
    next({ name: 'login' })
  } else if (to.name === 'login' && isAuthenticated) {
    next({ name: 'dashboard' })
  } else {
    next()
  }
})

export default router
