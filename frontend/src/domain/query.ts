/**
 * URL query ↔ 筛选条件（P2）。
 *
 * 纯逻辑、零 Vue 依赖：/ 与 /archive 共用一套规则，深链刷新、浏览器前进后退、
 * 跨页筛选一致都建立在这几个函数上。四个键缺省即 DEFAULT_FILTERS，所以「默认口径」的链接
 * 是干净的 /、/archive，不会拖一串 ?year=all&traveler=self…。
 */

import { DEFAULT_FILTERS, type Filters } from './filters'
import { CONFIDENCE, isTravelKind } from './kind'
import type { ConfidenceKey } from './types'

/** vue-router 的 LocationQuery / LocationQueryRaw 与这个结构互相兼容（避免 domain 依赖 Vue）。 */
export type QueryScalar = string | null | undefined
export type QueryLike = Record<string, QueryScalar | QueryScalar[]>

export const FILTER_QUERY_KEYS = ['year', 'traveler', 'kind', 'confidence'] as const
export type FilterQueryKey = (typeof FILTER_QUERY_KEYS)[number]
export const FOCUS_QUERY_KEY = 'focus'

const MAX_TRAVELER_LENGTH = 80
const MAX_FOCUS_LENGTH = 200

/** ?year=2024&year=2025 这类重复参数取第一个，数组形态也兼容。 */
function firstValue(value: QueryScalar | QueryScalar[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === 'string' ? raw : ''
}

/** 把任意来源（URL、表单、旧缓存）的筛选值收敛成合法 Filters。 */
export function sanitizeFilters(candidate: Partial<Filters> | null | undefined): Filters {
  const year = String(candidate?.year ?? '').trim()
  const traveler = String(candidate?.traveler ?? '').trim()
  const kind = String(candidate?.kind ?? '').trim()
  const confidence = String(candidate?.confidence ?? '').trim()

  return {
    // 年份只认 4 位数字；「all」和空串都归默认
    year: /^\d{4}$/.test(year) ? year : DEFAULT_FILTERS.year,
    // 旅客是自由文本（姓名来自数据 / 后端用户），只做长度与空白收敛
    traveler: traveler && traveler.length <= MAX_TRAVELER_LENGTH ? traveler : DEFAULT_FILTERS.traveler,
    // cancelled 可以出现在深链里（数据里仍有该 kind），但下拉不列它
    kind: kind !== 'all' && isTravelKind(kind) ? kind : DEFAULT_FILTERS.kind,
    confidence:
      confidence !== 'all' && Object.prototype.hasOwnProperty.call(CONFIDENCE, confidence)
        ? (confidence as ConfidenceKey)
        : DEFAULT_FILTERS.confidence,
  }
}

/** 从 URL query 读筛选；缺键 / 脏值一律回默认值，不让坏链接把页面筛空。 */
export function parseFilters(query: QueryLike = {}): Filters {
  return sanitizeFilters({
    year: firstValue(query.year),
    traveler: firstValue(query.traveler),
    kind: firstValue(query.kind),
    confidence: firstValue(query.confidence),
  })
}

export function sameFilters(a: Filters, b: Filters): boolean {
  return a.year === b.year && a.traveler === b.traveler && a.kind === b.kind && a.confidence === b.confidence
}

/** query 里是否显式带了筛选键：带了就由 URL 说了算（深链 / 前进后退）。 */
export function hasFilterQuery(query: QueryLike): boolean {
  return FILTER_QUERY_KEYS.some((key) => query[key] !== undefined)
}

/**
 * 把 store 的筛选写回 URL：
 * - 清掉四个筛选键后按「非默认才写」重建（默认口径的链接保持干净）；
 * - focus 只在主页写（档案页的可点行跳 /?focus=<id>，P4 接）；
 * - 其它参数（未来扩展、UTM 等）原样保留。
 */
export function buildFilterQuery(
  filters: Filters,
  query: QueryLike = {},
  focusId: string | null = null,
): QueryLike {
  const next: QueryLike = {}
  const managed = new Set<string>([...FILTER_QUERY_KEYS, FOCUS_QUERY_KEY])

  Object.entries(query).forEach(([key, value]) => {
    if (managed.has(key) || value === undefined) return
    next[key] = value
  })

  FILTER_QUERY_KEYS.forEach((key) => {
    const value = filters[key]
    if (value && value !== DEFAULT_FILTERS[key]) next[key] = value
  })

  if (focusId) next[FOCUS_QUERY_KEY] = focusId
  return next
}

/** /?focus=<id>：主页选中某一段；长度截断防止把巨长字符串塞进地址栏。 */
export function parseFocusId(query: QueryLike = {}): string | null {
  const value = firstValue(query[FOCUS_QUERY_KEY]).trim()
  return value && value.length <= MAX_FOCUS_LENGTH ? value : null
}

function queryValues(value: QueryScalar | QueryScalar[] | undefined): (string | null)[] {
  if (value === undefined) return []
  const list = Array.isArray(value) ? value : [value]
  return list.map((item) => (item === undefined ? null : item))
}

function sameQueryValue(
  a: QueryScalar | QueryScalar[] | undefined,
  b: QueryScalar | QueryScalar[] | undefined,
): boolean {
  const left = queryValues(a)
  const right = queryValues(b)
  return left.length === right.length && left.every((item, index) => item === right[index])
}

/** 比较 managed query 是否一致；用于在 watch 里挡住 router.replace 的回环。 */
export function sameQuery(a: QueryLike, b: QueryLike): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    if (!sameQueryValue(a[key], b[key])) return false
  }
  return true
}
