import { API_RECORDS_URL, API_USERS_URL, RECORDS_STORAGE_KEY } from '@/config'
import { fallbackMetadata, fallbackRecords } from '@/data/fallbackRecords'
import { normalize } from '@/domain/normalize'
import type { RawRecord, RawUser, RecordMetadata, TravelRecord } from '@/domain/types'

/**
 * 数据访问层：唯一的 fetch 出口 + 三级回退。
 *
 * 回退链（与旧版一致）：后端 `/api/records` → localStorage 缓存 `journeyatlas_records_v1` → 内置演示数据。
 * 每条路径都返回 source/message，方便页面显示「资料来自哪里」，也方便单测断言。
 */

export type RecordsSource = 'backend' | 'cache' | 'builtin'

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface RecordsResponse {
  records: RawRecord[]
  metadata: RecordMetadata
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage
  } catch {
    return null
  }
}

/** 读本机缓存的原始记录；读不到 / 解析失败都返回 null（缓存坏了就当没有）。 */
export function readCachedRecords(storage: StorageLike | null = defaultStorage()): RawRecord[] | null {
  try {
    const raw = storage?.getItem(RECORDS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as RawRecord[]) : null
  } catch {
    return null
  }
}

/** 写本机缓存（隐私模式下静默失败，不影响使用）。 */
export function writeCachedRecords(
  list: readonly TravelRecord[],
  storage: StorageLike | null = defaultStorage(),
): void {
  try {
    storage?.setItem(RECORDS_STORAGE_KEY, JSON.stringify(list, null, 2))
  } catch {
    /* 隐私模式 */
  }
}

export function clearCachedRecords(storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.removeItem(RECORDS_STORAGE_KEY)
  } catch {
    /* 隐私模式 */
  }
}

/**
 * 全量记录：GET /api/records。
 * 后端 handler 返回 `{ records, metadata }`，也兼容直接返回数组。
 */
export async function fetchAllTravelRecords(fetchImpl: typeof fetch = fetch): Promise<RecordsResponse> {
  const response = await fetchImpl(API_RECORDS_URL, { cache: 'no-store' })
  if (!response.ok) throw new Error(`旅行记录读取失败：HTTP ${response.status}`)
  const json = (await response.json()) as RawRecord[] | { records?: RawRecord[]; metadata?: RecordMetadata }
  const list = Array.isArray(json) ? json : json.records || []
  return { records: list, metadata: (Array.isArray(json) ? {} : json.metadata) || {} }
}

/** 用户列表：GET /api/users。兼容 `[...]` 与 `{ users: [...] }` 两种形状。 */
export async function fetchUsers(fetchImpl: typeof fetch = fetch): Promise<RawUser[]> {
  const response = await fetchImpl(API_USERS_URL, { cache: 'no-store' })
  if (!response.ok) throw new Error(`用户列表读取失败：HTTP ${response.status}`)
  const json = (await response.json()) as RawUser[] | { users?: RawUser[] }
  return Array.isArray(json) ? json : json.users || []
}

/**
 * 创建一条记录：POST /api/records。
 * 返回服务端落库后的记录（含服务端补齐的默认值 / id）；失败时抛错，由调用方决定是否降级。
 */
export async function createTravelRecord(
  record: RawRecord | TravelRecord,
  fetchImpl: typeof fetch = fetch,
): Promise<RawRecord> {
  const response = await fetchImpl(API_RECORDS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    let message = `创建行程失败：HTTP ${response.status}`
    if (detail) message += ` · ${detail}`
    throw new Error(message)
  }
  const json = (await response.json()) as { record?: RawRecord }
  return json.record || (record as unknown as RawRecord)
}

export interface PushResult {
  created: RawRecord[]
  failed: { item: RawRecord | TravelRecord; error: Error }[]
}

/** 批量创建（后端暂无 batch 接口，逐条 POST）：导入 JSON/CSV 时用，失败项统计回给用户。 */
export async function pushRecordsToBackend(
  list: readonly (RawRecord | TravelRecord)[],
  fetchImpl: typeof fetch = fetch,
): Promise<PushResult> {
  const created: RawRecord[] = []
  const failed: { item: RawRecord | TravelRecord; error: Error }[] = []
  for (const item of list) {
    try {
      created.push(await createTravelRecord(item, fetchImpl))
    } catch (error) {
      failed.push({ item, error: error instanceof Error ? error : new Error(String(error)) })
    }
  }
  return { created, failed }
}

export interface LoadedRecords {
  records: TravelRecord[]
  metadata: RecordMetadata
  source: RecordsSource
  /** 可直接显示在「数据状态」位置的一句话 */
  message: string
}

export interface LoadRecordsOptions {
  fetchImpl?: typeof fetch
  /** 传 null 表示不读写 localStorage（单测用）；不传则用浏览器 localStorage */
  storage?: StorageLike | null
  fallback?: readonly RawRecord[]
}

/**
 * 主页/档案加载：以后端为准主动拉一次全量记录；后端不可用时依次回退到
 * ①上次成功拉取的本机缓存 ②内置演示数据，保证断网也能看到东西。
 */
export async function loadRecords(options: LoadRecordsOptions = {}): Promise<LoadedRecords> {
  const fetchImpl = options.fetchImpl ?? fetch
  const storage = options.storage === undefined ? defaultStorage() : options.storage
  const fallback = options.fallback ?? fallbackRecords

  try {
    const { records: raw, metadata } = await fetchAllTravelRecords(fetchImpl)
    const records = normalize(raw)
    writeCachedRecords(records, storage)
    return {
      records,
      metadata,
      source: 'backend',
      message: `${metadata.lastUpdated || '当前'} 资料，${records.length} 条行程 · 来自后端`,
    }
  } catch (error) {
    console.error('后端记录读取失败，回退本机数据', error)
  }

  const cached = readCachedRecords(storage)
  if (cached) {
    try {
      const records = normalize(cached)
      return {
        records,
        metadata: {},
        source: 'cache',
        message: `后端未连接，使用本机缓存，${records.length} 条行程`,
      }
    } catch {
      /* 缓存坏了就当没有 */
    }
  }

  const records = normalize(fallback)
  return {
    records,
    metadata: fallbackMetadata,
    source: 'builtin',
    message: `后端未连接，使用内置资料，${records.length} 条行程`,
  }
}
