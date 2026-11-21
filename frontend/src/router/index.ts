import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import { DOC_TITLE_SUFFIX } from '@/config'
import { usePrefsStore } from '@/stores/prefs'
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

// 标签页标题交给 prefs store：自定义标题（yw-site-title）优先，否则按路由页名拼。
// 初始导航时 Pinia 可能尚未激活，try/catch 退回纯标题，prefs.load() 之后再纠正。
router.afterEach((to) => {
  const pageTitle = typeof to.meta.title === 'string' ? to.meta.title : ''
  try {
    usePrefsStore().setPageTitle(pageTitle)
  } catch {
    document.title = pageTitle ? `${pageTitle} · ${DOC_TITLE_SUFFIX}` : `${DOC_TITLE_SUFFIX} · 行旅地图`
  }
})

export default router
