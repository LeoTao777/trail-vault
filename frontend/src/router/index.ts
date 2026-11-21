import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import HomeView from '@/views/HomeView.vue'

// 三条路由 = 三张页面：主页（地图 + 时间线）/ 录入 / 旅行档案。
// 详情（ArchiveView、录入表单）按需懒加载，主包只留主页所需代码。
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
    meta: { title: '地图 · 时间线' },
  },
  {
    path: '/record',
    name: 'record',
    component: () => import('@/views/RecordView.vue'),
    meta: { title: '录入' },
  },
  {
    path: '/archive',
    name: 'archive',
    component: () => import('@/views/ArchiveView.vue'),
    meta: { title: '旅行档案' },
  },
  // 未知路径回主页（后端 NoRoute 已把非 /api 路径兜底到 index.html）
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 }
  },
})

const SITE_NAME = 'TrailVault'

router.afterEach((to) => {
  const title = typeof to.meta.title === 'string' ? to.meta.title : ''
  document.title = title ? `${title} · ${SITE_NAME}` : `${SITE_NAME} · 行旅地图`
})

export default router
