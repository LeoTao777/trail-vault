import { isTravelKind } from './kind'
import type { RawRecord, TravelRecord } from './types'

/** 空串 / null / undefined → null；能转成有限数字就用数字，否则 null。 */
export function parseOptionalNumber(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

/**
 * 脏数据兜底 —— 旧版行为一字不改（每一条都有单测锁住，别"顺手清理"）：
 *
 * 1. `"false"` 字符串认作 false（早期导入把布尔写成字符串），只有 !== false 且 !== "false" 才为 true；
 * 2. `people` 支持数组，也支持 `"甲、乙"` / `"甲,乙"` / `"甲/乙"` 这类字符串拆分；
 * 3. 未知 kind → `other`，但 `cancelled` 依然保留（它是状态，不进类型筛选选项）；
 * 4. 缺 id 用 `${startDate}-${index}` 兜底（index 是**原始数组**下标，不随排序变化）；
 * 5. 缺 endDate 用 startDate；缺 title 用「起 → 讫」；缺 traveler 用 people 拼接；
 * 6. 金额/时长转数字或 null；confidence 缺省 `pending`；displayLayer 缺省 `journey`；
 * 7. 输出按 startDate 升序（字符串比较，ISO 日期天然有序）。
 */
export function normalize(list: readonly RawRecord[]): TravelRecord[] {
  const normalized = list.map((item, index) => {
    const amount = parseOptionalNumber(item.amountCny)
    const invoiceAmount = parseOptionalNumber(item.invoiceAmountCny)
    const durationMinutes = parseOptionalNumber(item.durationMinutes)
    const people: string[] = Array.isArray(item.people)
      ? (item.people as string[])
      : String(item.people || item.traveler || '')
          .split(/[、,，/]/)
          .map((value) => value.trim())
          .filter(Boolean)

    const record = {
      ...item,
      id: item.id || `${item.startDate || 'date'}-${index}`,
      endDate: item.endDate || item.startDate,
      kind: isTravelKind(item.kind) ? item.kind : 'other',
      title: item.title || [item.origin, item.destination].filter(Boolean).join(' → ') || '未命名行程',
      amountCny: amount,
      invoiceAmountCny: invoiceAmount,
      durationMinutes,
      confidence: item.confidence || 'pending',
      traveler: item.traveler || people.join(' / ') || '待确认',
      people,
      countsAsAway: item.countsAsAway !== false && item.countsAsAway !== 'false',
      countsAsVisited: item.countsAsVisited !== false && item.countsAsVisited !== 'false',
      showInTimeline: item.showInTimeline !== false && item.showInTimeline !== 'false',
      displayLayer: item.displayLayer || 'journey',
    }

    // 旧版是 {...item} 透传：缺的字段不补空串，保证 POST 回后端的 payload 与旧版逐字节一致。
    return record as unknown as TravelRecord
  })

  return normalized.sort((a, b) => String(a.startDate || '').localeCompare(String(b.startDate || '')))
}
