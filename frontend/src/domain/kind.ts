import type { ConfidenceKey, TravelKind } from './types'

/** 交通方式 → 中文标签 + 语义色（色值走 CSS 令牌，地图/榜单/时间线共用）。 */
export interface KindMeta {
  label: string
  color: string
}

export const KIND: Record<TravelKind, KindMeta> = {
  flight: { label: '航班', color: 'var(--flight)' },
  rail: { label: '铁路', color: 'var(--rail)' },
  road: { label: '地面/水路', color: 'var(--road)' },
  stay: { label: '停留', color: 'var(--stay)' },
  cancelled: { label: '退改', color: 'rgba(248, 242, 230, .48)' },
  other: { label: '门票/其他', color: 'var(--other)' },
}

export const CONFIDENCE: Record<ConfidenceKey, string> = {
  confirmed: '已确认',
  partial: '部分确认',
  inferred: '推定',
  pending: '缺口·待补段',
}

/** 「移动段」：只有这三种才算里程 / 出行次数 / 移动时长。 */
export const MOVE_KINDS: readonly TravelKind[] = ['flight', 'rail', 'road']

export function isTravelKind(value: unknown): value is TravelKind {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(KIND, value)
}

export function isMoveKind(kind: string): boolean {
  return MOVE_KINDS.includes(kind as TravelKind)
}

/** 类型筛选不列「退改」——它是状态不是出行方式（数据里仍保留该 kind）。 */
export const FILTERABLE_KINDS: readonly TravelKind[] = (Object.keys(KIND) as TravelKind[]).filter(
  (key) => key !== 'cancelled',
)

export function kindLabel(kind: string): string {
  return isTravelKind(kind) ? KIND[kind].label : kind
}

export function kindColor(kind: string): string {
  return isTravelKind(kind) ? KIND[kind].color : 'var(--other)'
}

/** 旧版口径：`CONFIDENCE[value] || value || '缺口·待补段'`。 */
export function confidenceLabel(value: string): string {
  const key = value as ConfidenceKey
  return CONFIDENCE[key] || value || CONFIDENCE.pending
}
