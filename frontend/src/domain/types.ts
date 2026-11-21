/** 行旅记录与筛选的类型定义（与后端 model.TravelRecord 对齐）。 */

export type TravelKind = 'flight' | 'rail' | 'road' | 'stay' | 'cancelled' | 'other'

export type ConfidenceKey = 'confirmed' | 'partial' | 'inferred' | 'pending'

export type LngLat = [number, number]

/**
 * 归一化之后的行程记录 —— normalize() 的输出，前端各处只认这个形状。
 *
 * 注意：normalize() 保留了旧版「{...item} 透传」语义（后端/导入文件里缺的字段不会被补空串），
 * 所以文本型字段在运行时仍可能是 undefined。读取时沿用旧版的 `x || ''` 写法。
 */
export interface TravelRecord {
  id: string
  startDate: string
  endDate: string
  kind: TravelKind
  title: string
  origin: string
  destination: string
  departTime: string
  arriveTime: string
  durationMinutes: number | null
  transportNo: string
  amountCny: number | null
  invoiceAmountCny: number | null
  traveler: string
  people: string[]
  confidence: ConfidenceKey
  countsAsAway: boolean
  countsAsVisited: boolean
  showInTimeline: boolean
  displayLayer: string
  evidence: string
  notes: string
  project: string
  purpose: string
  reimbursement: string
  /** 动态算出的「待补连接段」占位条目：不写库、不画线、不进统计 */
  _gap?: boolean
}

/** 后端 / 导入文件给的原始记录：字段可能缺失、类型可能脏（"false" 字符串、数字字符串…）。 */
export type RawRecord = Record<string, unknown>

export interface RecordMetadata {
  lastUpdated?: string
  title?: string
  version?: string
  owner?: string
  notes?: string[]
  [key: string]: unknown
}

/** 后端 User：旅客名取 username，缺失时退回 name / email。 */
export interface BackendUser {
  id?: number | string
  username?: string
  name?: string
  email?: string
  [key: string]: unknown
}

export type RawUser = BackendUser | string
