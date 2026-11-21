import { OWNER_NAME } from '@/config'

import { normalize } from '@/domain/normalize'
import type { RawRecord, TravelRecord } from '@/domain/types'

/**
 * 测试用记录工厂：补齐让 normalize() 不再改写的「正常」默认值，
 * 这样每个用例只需要写出与它要验证的口径相关的字段。
 */
export function rawRecord(partial: RawRecord): RawRecord {
  return {
    kind: 'rail',
    confidence: 'confirmed',
    traveler: OWNER_NAME,
    people: [OWNER_NAME],
    countsAsAway: true,
    countsAsVisited: true,
    showInTimeline: true,
    ...partial,
  }
}

export function records(...partials: RawRecord[]): TravelRecord[] {
  return normalize(partials.map(rawRecord))
}
