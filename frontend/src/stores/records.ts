/**
 * 全站唯一的数据 + 筛选状态（P2）。
 *
 * 页面不再各自 getElementById 取 select 的值：
 *   - records / filters / selectedId 只有这里持有；
 *   - filteredRecords = domain/filteredRecords(records, filters)（含 pending 动态缺口注入）；
 *   - filters 与 /、/archive 的 URL query 双向同步由 composables/filterQuery.ts 负责。
 *
 * 数据仍走 api/client.ts 的三级回退：后端 → journeyatlas_records_v1 缓存 → 内置演示数据。
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import {
  clearCachedRecords,
  fetchUsers,
  loadRecords,
  writeCachedRecords,
  type LoadedRecords,
  type RecordsSource,
} from '@/api/client'
import {
  DEFAULT_FILTERS,
  describeScope,
  filterOptions,
  filterRecords as filterWithoutGaps,
  filteredRecords as filterWithGaps,
  usernameOf,
  type Filters,
  type FilterOptions,
} from '@/domain/filters'
import { sanitizeFilters, sameFilters } from '@/domain/query'
import { computeMetrics } from '@/domain/stats'
import type { RecordMetadata, TravelRecord } from '@/domain/types'

import { useToastStore } from './toast'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export const useRecordsStore = defineStore('records', () => {
  /* ——— 数据 ——— */
  const records = ref<TravelRecord[]>([])
  const metadata = ref<RecordMetadata>({})
  const source = ref<RecordsSource>('builtin')
  const message = ref('尚未加载资料')
  const loading = ref(false)
  const refreshing = ref(false)
  const error = ref('')
  const loaded = ref(false)

  /* ——— 旅客下拉（/api/users，失败不阻断页面） ——— */
  const users = ref<string[]>([])
  const usersLoaded = ref(false)

  /* ——— 筛选 / 选中 ——— */
  const filters = ref<Filters>({ ...DEFAULT_FILTERS })
  const selectedId = ref('')
  /** 主页深链 /?focus=<id>；档案页的可点行 P4 会跳回 /?focus=<id> */
  const focusId = ref<string | null>(null)

  let pending: Promise<void> | null = null
  let usersPending: Promise<string[]> | null = null

  /** 当前可见记录（confidence=pending 时注入动态缺口，口径与旧版 filteredRecords 一致）。 */
  const filteredRecords = computed(() => filterWithGaps(records.value, filters.value))
  /** 明细表 / 榜单用：同样的筛选，但不注入缺口占位。 */
  const ledgerRecords = computed(() => filterWithoutGaps(records.value, filters.value))
  const options = computed<FilterOptions>(() => filterOptions(records.value, users.value))
  const scopeLabel = computed(() => describeScope(filters.value))
  const metrics = computed(() => computeMetrics(filteredRecords.value))
  const selectedRecord = computed(
    () => filteredRecords.value.find((record) => record.id === selectedId.value) ?? null,
  )

  /** 旧版 render() 的语义：选中的段被筛掉后，自动落到当前可见的第一段。 */
  function ensureSelected(): void {
    const list = filteredRecords.value
    if (selectedId.value && list.some((record) => record.id === selectedId.value)) return
    selectedId.value = list.find((record) => record.showInTimeline !== false)?.id || list[0]?.id || ''
  }

  function applyLoaded(result: LoadedRecords): void {
    records.value = result.records
    metadata.value = result.metadata
    source.value = result.source
    message.value = result.message
    // 深链 /?focus=id 在首屏数据到手之后才真正生效（刚进页面时 records 还是空的）
    if (focusId.value) setFocusId(focusId.value)
    ensureSelected()
  }

  /**
   * 首屏加载：并发调用只会发一次请求；三级回退在 api/client.ts 里完成。
   * 用户列表异步补，不阻塞首屏。
   */
  function ensureLoaded(): Promise<void> {
    if (loaded.value) return Promise.resolve()
    if (pending) return pending

    const task = (async () => {
      loading.value = true
      error.value = ''
      try {
        applyLoaded(await loadRecords())
        loaded.value = true
      } catch (caught) {
        // loadRecords 自身已三级回退，这里只兜底极端异常，避免页面一直转圈
        error.value = errorMessage(caught)
        message.value = '资料读取失败'
        records.value = []
        loaded.value = true
      } finally {
        loading.value = false
        pending = null
      }
      void ensureUsers()
    })()
    pending = task
    return task
  }

  /** 主页「刷新」按钮：只走后端；后端没连上就保留上一次的资料并提示。 */
  async function refresh(options: { silent?: boolean } = {}): Promise<LoadedRecords | null> {
    if (refreshing.value) return null
    refreshing.value = true
    error.value = ''
    const toast = useToastStore()
    try {
      const result = await loadRecords()
      if (result.source !== 'backend') {
        // 首屏还没数据时照样用回退结果；已经显示过资料时保留旧数据，别把页面清空
        if (!loaded.value) applyLoaded(result)
        else {
          error.value = '后端未连接'
          message.value = '刷新失败：后端未连接，仍显示上一次的资料'
        }
        loaded.value = true
        if (!options.silent) toast.push('刷新失败：后端未连接', 'warn', 2600)
        return result
      }
      applyLoaded(result)
      loaded.value = true
      if (!options.silent) toast.push(`已从后端刷新：${result.records.length} 条行程`, 'info', 1600)
      return result
    } catch (caught) {
      const text = errorMessage(caught)
      error.value = text
      message.value = `刷新失败：${text}（仍显示上一次的资料）`
      if (!options.silent) toast.push(`刷新失败：${text}`, 'error', 2600)
      return null
    } finally {
      refreshing.value = false
    }
  }

  /** 旅客筛选下拉：GET /api/users，失败留空（筛选仍回落到行程内旅客名）。 */
  function ensureUsers(): Promise<string[]> {
    if (usersLoaded.value) return Promise.resolve(users.value)
    if (usersPending) return usersPending

    const task = (async () => {
      try {
        const list = await fetchUsers()
        users.value = list.map(usernameOf).filter(Boolean)
      } catch (caught) {
        console.error('用户列表读取失败', caught)
        users.value = []
      } finally {
        usersLoaded.value = true
        usersPending = null
      }
      return users.value
    })()
    usersPending = task
    return task
  }

  /* ——— 筛选动作（唯一写入口；URL 同步由 composable 监听） ——— */
  function setFilters(patch: Partial<Filters>): void {
    const next = sanitizeFilters({ ...filters.value, ...patch })
    if (sameFilters(next, filters.value)) return
    filters.value = next
    ensureSelected()
  }

  function resetFilters(): void {
    setFilters({ ...DEFAULT_FILTERS })
  }

  /** 时间线 / 地图点选：选中并把深链写成 /?focus=<id>（P3 接）。 */
  function select(id: string): void {
    selectedId.value = id
    focusId.value = id || null
  }

  /**
   * URL → store 的 focus。若该段存在但被当前筛选挡住，清掉筛选再定位
   * （旧版 jumpToLedgerRow 的行为）；不存在的 id 不造一条假选中。
   */
  function setFocusId(id: string | null): void {
    const next = id ? id.trim().slice(0, 200) || null : null
    focusId.value = next
    if (!next) return
    if (!records.value.some((record) => record.id === next)) return
    if (!filteredRecords.value.some((record) => record.id === next)) {
      filters.value = { ...DEFAULT_FILTERS }
    }
    selectedId.value = next
  }

  /** 离开主页 / 清除深链：只清 focus，保留当前选中的段。 */
  function clearFocus(): void {
    focusId.value = null
  }

  /* ——— P5「数据工具」会用到的两个动作（后端暂无删除接口，语义与旧版一致） ——— */
  function clearAll(): void {
    records.value = []
    selectedId.value = ''
    focusId.value = null
    filters.value = { ...DEFAULT_FILTERS }
    source.value = 'cache'
    message.value = '空白地图，0 条行程'
    writeCachedRecords([])
  }

  async function reload(): Promise<void> {
    clearCachedRecords()
    loaded.value = false
    records.value = []
    selectedId.value = ''
    await ensureLoaded()
  }

  return {
    records,
    metadata,
    source,
    message,
    loading,
    refreshing,
    error,
    loaded,
    users,
    usersLoaded,
    filters,
    selectedId,
    focusId,
    filteredRecords,
    ledgerRecords,
    options,
    scopeLabel,
    metrics,
    selectedRecord,
    ensureLoaded,
    refresh,
    ensureUsers,
    setFilters,
    resetFilters,
    select,
    setFocusId,
    clearFocus,
    clearAll,
    reload,
  }
})
