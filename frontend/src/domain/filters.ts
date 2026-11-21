import { OWNER_NAME } from '@/config'

import { cityNames, stripShi } from './city'
import { computeContinuityGaps } from './chain'
import { CONFIDENCE, FILTERABLE_KINDS, KIND, confidenceLabel, kindLabel } from './kind'
import type { ConfidenceKey, RawUser, TravelKind, TravelRecord } from './types'

/** 筛选条件（唯一真相源，P2 起写进 URL query）。 */
export interface Filters {
  year: string
  traveler: string
  kind: string
  confidence: string
}

export const DEFAULT_FILTERS: Filters = {
  year: 'all',
  traveler: 'self',
  kind: 'all',
  confidence: 'all',
}

/** 旅客归属判断：self = 站点主人，all = 不筛，其余按名字包含匹配（兼容「Nova Kepler (本人)」这类写法）。 */
export function includesTraveler(record: TravelRecord, traveler: string): boolean {
  if (traveler === 'all') return true
  const people = record.people || []
  if (traveler === 'self') return record.traveler.includes(OWNER_NAME) || people.includes(OWNER_NAME)
  return record.traveler.includes(traveler) || people.includes(traveler)
}

function matchesFilters(record: TravelRecord, active: Filters): boolean {
  if (active.year !== 'all' && !String(record.startDate || '').startsWith(active.year)) return false
  if (active.kind !== 'all' && record.kind !== active.kind) return false
  if (active.confidence !== 'all' && record.confidence !== active.confidence) return false
  if (!includesTraveler(record, active.traveler)) return false
  return true
}

/** 只做筛选，不注入缺口（档案页/明细表用）。 */
export function filterRecords(list: readonly TravelRecord[], active: Filters): TravelRecord[] {
  return list.filter((record) => matchesFilters(record, active))
}

/**
 * 当前可见记录。
 *
 * 只有筛「待补证据」时，才把动态算出的断点占位条目并进来（其余视图保持干净，不受影响）。
 */
export function filteredRecords(list: readonly TravelRecord[], active: Filters): TravelRecord[] {
  const pool = active.confidence === 'pending' ? [...list, ...computeContinuityGaps(list)] : [...list]
  return pool.filter((record) => matchesFilters(record, active))
}

export interface FilterOptions {
  years: string[]
  /** 已排除包含站点主人名（留在「全部旅客/自己」里）的重复项 */
  travelers: string[]
  kinds: { key: TravelKind; label: string }[]
  confidences: { key: ConfidenceKey; label: string }[]
  /** 地点联想 datalist（内置城市表） */
  cities: string[]
}

/** 筛选下拉的选项：全部由数据推导（年份、旅客），不写死。 */
export function filterOptions(list: readonly TravelRecord[], users: readonly string[] = []): FilterOptions {
  const years = Array.from(
    new Set(list.map((record) => String(record.startDate || '').slice(0, 4)).filter(Boolean)),
  ).sort()

  const travelers = Array.from(
    new Set([
      ...users,
      ...list.flatMap((record) => [record.traveler, ...(record.people || [])]).filter(Boolean),
    ]),
  ).sort((a, b) => a.localeCompare(b, 'zh-CN'))

  return {
    years,
    travelers: travelers.filter((name) => name && !name.includes(OWNER_NAME)),
    kinds: FILTERABLE_KINDS.map((key) => ({ key, label: KIND[key].label })),
    confidences: (Object.keys(CONFIDENCE) as ConfidenceKey[]).map((key) => ({
      key,
      label: CONFIDENCE[key],
    })),
    cities: cityNames(),
  }
}

/** 统计口径标签：「2024 年 · Nova Kepler · 铁路 · 部分确认」。 */
export function describeScope(active: Filters): string {
  const parts: string[] = [active.year && active.year !== 'all' ? `${active.year} 年` : '全部年份']
  parts.push(
    active.traveler === 'self' ? OWNER_NAME : active.traveler === 'all' ? '全部旅客' : active.traveler,
  )
  if (active.kind && active.kind !== 'all') parts.push(kindLabel(active.kind))
  if (active.confidence && active.confidence !== 'all') parts.push(confidenceLabel(active.confidence))
  return parts.join(' · ')
}

/**
 * 搜索联想打分：车次/航班号前缀最高，其次城市、标题、项目。
 * 明细表内搜索与主页搜索共用同一套（旧版是两个入口一个函数）。
 */
export function buildSuggestions(list: readonly TravelRecord[], query: string, limit = 8): TravelRecord[] {
  const q = String(query || '')
    .trim()
    .toLowerCase()
  if (!q) return []

  const scored: { record: TravelRecord; score: number }[] = []
  list.forEach((record) => {
    const transportNo = String(record.transportNo || '').toLowerCase()
    const origin = String(record.origin || '').toLowerCase()
    const destination = String(record.destination || '').toLowerCase()
    const title = String(record.title || '').toLowerCase()
    const project = String(record.project || record.purpose || '').toLowerCase()

    let score = 0
    if (transportNo && transportNo.startsWith(q)) score = 100
    else if (transportNo && transportNo.includes(q)) score = 80
    else if (origin.startsWith(q) || destination.startsWith(q)) score = 70
    else if (origin.includes(q) || destination.includes(q)) score = 60
    else if (title.includes(q)) score = 40
    else if (project.includes(q)) score = 30
    if (score) scored.push({ record, score })
  })

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      String(a.record.transportNo || '').localeCompare(String(b.record.transportNo || ''), 'en') ||
      String(b.record.startDate || '').localeCompare(String(a.record.startDate || '')),
  )

  return scored.slice(0, limit).map((item) => item.record)
}

/** 旅客名：后端 User.Username；字段缺失时退到 name / email，兼容纯字符串数组。 */
export function usernameOf(user: RawUser): string {
  if (typeof user === 'string') return user.trim()
  return String(user?.username || user?.name || user?.email || '').trim()
}

/** 路线键（双向合并的走廊）：A⇌B 与 B⇌A 是同一条。口径与旧版一致：只去「市」，不查车站别名。 */
export function routeKey(origin: string, destination: string): string {
  const pair = [stripShi(origin), stripShi(destination)].sort()
  return `${pair[0]} ⇌ ${pair[1]}`
}
