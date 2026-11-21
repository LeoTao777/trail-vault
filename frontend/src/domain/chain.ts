import { OWNER_NAME } from '@/config'

import { cityKey } from './city'
import { isMoveKind } from './kind'
import type { TravelRecord } from './types'

/**
 * 同日链式贪心排序：先按日期+时刻排，再对「同一天内无时刻」的段，
 * 把能接上前一段到达城的排前面。
 *
 * 修掉 同日「A→B(航班)」+「B→C(自驾)」因无时刻而排反、平白制造断点/丢夜数的问题。
 */
export function chainSortSegs(segs: readonly TravelRecord[]): TravelRecord[] {
  const sorted = [...segs].sort(
    (a, b) =>
      String(a.startDate || '').localeCompare(String(b.startDate || '')) ||
      String(a.departTime || '').localeCompare(String(b.departTime || '')),
  )

  const out: TravelRecord[] = []
  let i = 0
  while (i < sorted.length) {
    let j = i
    while (j < sorted.length && sorted[j].startDate === sorted[i].startDate) j += 1
    const day = sorted.slice(i, j)

    if (day.length > 1 && day.some((seg) => !seg.departTime)) {
      let current = out.length ? cityKey(out[out.length - 1].destination) : null
      const pool = [...day]
      while (pool.length) {
        const index = current ? pool.findIndex((seg) => cityKey(seg.origin) === current) : -1
        const next = index >= 0 ? pool.splice(index, 1)[0] : pool.shift()
        if (!next) break
        out.push(next)
        current = cityKey(next.destination)
      }
    } else {
      out.push(...day)
    }

    i = j
  }
  return out
}

/**
 * 行程连续性缺口（断点）：把已录行程按时间排序，「到达地 ≠ 下一段出发地」即缺一段连接。
 *
 * 动态算出，做成 confidence=pending 的「待补」占位条目 —— 只在筛「待补证据」时注入，
 * 不写进数据、不画线（countsAsVisited:false）、不进统计/播放；补齐某段后此缺口自动消失。
 */
export function computeContinuityGaps(list: readonly TravelRecord[]): TravelRecord[] {
  const segs = chainSortSegs(
    list.filter(
      (record) =>
        isMoveKind(record.kind) &&
        record.countsAsVisited !== false &&
        record.origin &&
        record.destination &&
        cityKey(record.origin) !== cityKey(record.destination),
    ),
  )

  const gaps: TravelRecord[] = []
  // 已凭国家移民局出入境记录完整录入的相邻口岸往返（深圳↔香港、珠海↔澳门）：
  // 所有过境都在库，残留「断点」只是无时刻记录排不出顺序的假象，不是真缺段，整对跳过。
  const BORDER = new Set(['深圳|香港', '香港|深圳', '珠海|澳门', '澳门|珠海'])

  for (let i = 0; i < segs.length - 1; i += 1) {
    const current = segs[i]
    const next = segs[i + 1]
    const arrived = cityKey(current.destination)
    const departed = cityKey(next.origin)
    if (BORDER.has(`${arrived}|${departed}`)) continue
    // 同一天的「断点」多是无时刻过境记录的排序假象（零天里塞不下一段真行程），跳过
    if (arrived !== departed && next.startDate && next.startDate !== (current.endDate || current.startDate)) {
      gaps.push({
        id: `gap-${arrived}-${departed}-${i}`,
        _gap: true,
        kind: 'other',
        confidence: 'pending',
        title: `${arrived} → ${departed}`,
        origin: arrived,
        destination: departed,
        startDate: current.endDate || current.startDate || '',
        endDate: next.startDate || '',
        departTime: '',
        arriveTime: '',
        durationMinutes: null,
        transportNo: '',
        amountCny: null,
        invoiceAmountCny: null,
        traveler: OWNER_NAME,
        people: [OWNER_NAME],
        project: '',
        purpose: '',
        evidence: '',
        notes: `待补连接段：${current.endDate || current.startDate} 到「${arrived}」… ${next.startDate} 从「${departed}」出发；找到这段票截图发我即可。`,
        countsAsAway: false,
        countsAsVisited: false,
        showInTimeline: true,
        displayLayer: 'journey',
        reimbursement: '',
      })
    }
  }
  return gaps
}
