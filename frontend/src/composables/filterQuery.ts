/**
 * 筛选状态 ↔ URL query 双向同步（P2 的核心）。
 *
 * 挂在 AppShell 上（三页都在），规则：
 *  1. 只有 / 与 /archive 带筛选；/record 不带，但 store 里的筛选不会丢，回主页/档案页时写回 URL → 跨页一致；
 *  2. URL 里显式带了筛选键（深链、收藏、浏览器前进后退）→ URL 说了算，回写 store；
 *  3. 用户在 FilterBar 改了筛选 → store 说了算，router.replace 写回 URL（不污染历史栈）；
 *  4. 默认值不写进 URL，参数保持干净；focus 只在主页写。
 *
 * 两个方向都先比较再写入，避免 watch ↔ router.replace 的无限回环。
 */

import { watch } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'

import {
  buildFilterQuery,
  hasFilterQuery,
  parseFilters,
  parseFocusId,
  sameFilters,
  sameQuery,
  type QueryLike,
} from '@/domain/query'
import { useRecordsStore } from '@/stores/records'

const FILTERED_PATHS = new Set(['/', '/archive'])

function toRawQuery(query: QueryLike): LocationQueryRaw {
  const raw: Record<string, unknown> = {}
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) raw[key] = value
  })
  return raw as LocationQueryRaw
}

export function useFilterQuerySync(): void {
  const route = useRoute()
  const router = useRouter()
  const store = useRecordsStore()

  function applyRouteToStore(): void {
    if (!FILTERED_PATHS.has(route.path)) return
    const query: QueryLike = route.query

    if (hasFilterQuery(query)) {
      const parsed = parseFilters(query)
      if (!sameFilters(parsed, store.filters)) store.setFilters(parsed)
    }

    const focus = route.path === '/' ? parseFocusId(query) : null
    if (focus !== store.focusId) store.setFocusId(focus)
  }

  function applyStoreToRoute(): void {
    if (!FILTERED_PATHS.has(route.path)) return
    const query: QueryLike = route.query
    const next = buildFilterQuery(store.filters, query, route.path === '/' ? store.focusId : null)
    if (sameQuery(next, query)) return
    void router.replace({ query: toRawQuery(next), hash: route.hash })
  }

  watch(
    () => route.fullPath,
    () => {
      applyRouteToStore()
      applyStoreToRoute()
    },
    { immediate: true },
  )

  watch(
    () => [store.filters, store.focusId] as const,
    () => applyStoreToRoute(),
    { deep: true },
  )
}
