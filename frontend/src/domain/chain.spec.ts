import { describe, expect, it } from 'vitest'

import { records } from '@/test/records'

import { chainSortSegs, computeContinuityGaps } from './chain'

describe('chainSortSegs 同日链式排序', () => {
  it('同一天无时刻的两段，按「能接上前一段到达城」排前面', () => {
    const list = records(
      { startDate: '2024-01-04', origin: '南京', destination: '上海' },
      // 同一天，输入顺序是反的：先录了 B→C（杭州→南京），后录 A→B（上海→杭州）
      { startDate: '2024-01-05', origin: '杭州', destination: '南京' },
      { startDate: '2024-01-05', origin: '上海', destination: '杭州' },
    )

    const sorted = chainSortSegs(list).map((record) => `${record.origin}→${record.destination}`)
    // 前一段到达「上海」，所以 01-05 的「上海→杭州」要排在「杭州→南京」之前
    expect(sorted).toEqual(['南京→上海', '上海→杭州', '杭州→南京'])
  })

  it('同一天都有时刻时保持「日期 + 时刻」的顺序，不做链式重排', () => {
    const list = records(
      { startDate: '2024-01-05', origin: '北京', destination: '上海', departTime: '08:00' },
      { startDate: '2024-01-05', origin: '上海', destination: '杭州', departTime: '12:00' },
    )

    const sorted = chainSortSegs([list[1], list[0]])
    expect(sorted.map((record) => record.origin)).toEqual(['北京', '上海'])
  })

  it('不同日期按日期升序，不跨天链式', () => {
    const list = records(
      { startDate: '2024-02-01', origin: '上海', destination: '杭州' },
      { startDate: '2024-01-01', origin: '北京', destination: '上海' },
    )
    expect(chainSortSegs(list).map((record) => record.startDate)).toEqual(['2024-01-01', '2024-02-01'])
  })

  it('车站名与城市名视为同一座城（别名归一）', () => {
    const list = records(
      { startDate: '2024-01-04', origin: '北京', destination: '上海虹桥' },
      { startDate: '2024-01-05', origin: '杭州东', destination: '南京' },
      { startDate: '2024-01-05', origin: '上海', destination: '杭州' },
    )
    const sorted = chainSortSegs(list)
    expect(sorted.slice(1).map((record) => `${record.origin}→${record.destination}`)).toEqual([
      '上海→杭州',
      '杭州东→南京',
    ])
  })
})

describe('computeContinuityGaps 断点口径', () => {
  it('到达地 ≠ 下一段出发地 → 生成一条待补占位（不点亮、不进统计）', () => {
    const list = records(
      { startDate: '2024-01-01', endDate: '2024-01-02', origin: '上海', destination: '北京' },
      { startDate: '2024-01-05', endDate: '2024-01-05', origin: '东京', destination: '京都' },
    )

    const gaps = computeContinuityGaps(list)
    expect(gaps).toHaveLength(1)

    const [gap] = gaps
    expect(gap._gap).toBe(true)
    expect(gap.id).toBe('gap-北京-东京-0')
    expect(gap.title).toBe('北京 → 东京')
    expect(gap.origin).toBe('北京')
    expect(gap.destination).toBe('东京')
    expect(gap.startDate).toBe('2024-01-02')
    expect(gap.endDate).toBe('2024-01-05')
    expect(gap.kind).toBe('other')
    expect(gap.confidence).toBe('pending')
    expect(gap.countsAsVisited).toBe(false)
    expect(gap.countsAsAway).toBe(false)
    expect(gap.amountCny).toBeNull()
    expect(gap.durationMinutes).toBeNull()
    expect(gap.notes).toContain('待补连接段')
  })

  it('口岸往返（深圳↔香港、珠海↔澳门）整对跳过', () => {
    const list = records(
      { startDate: '2024-01-01', endDate: '2024-01-01', origin: '广州', destination: '深圳' },
      { startDate: '2024-01-03', endDate: '2024-01-03', origin: '香港', destination: '东京' },
    )
    expect(computeContinuityGaps(list)).toHaveLength(0)
  })

  it('同一天的断点是无时刻过境的排序假象，跳过', () => {
    const list = records(
      { startDate: '2024-01-01', endDate: '2024-01-01', origin: '北京', destination: '上海' },
      { startDate: '2024-01-01', endDate: '2024-01-01', origin: '广州', destination: '深圳' },
    )
    expect(computeContinuityGaps(list)).toHaveLength(0)
  })

  it('同城往返不算断点', () => {
    const list = records(
      { startDate: '2024-01-01', endDate: '2024-01-02', origin: '上海', destination: '杭州' },
      { startDate: '2024-01-02', endDate: '2024-01-03', origin: '杭州', destination: '上海' },
    )
    expect(computeContinuityGaps(list)).toHaveLength(0)
  })

  it('只算 countsAsVisited=false 之外的移动段（停留/门票不参与）', () => {
    const list = records(
      { startDate: '2024-01-01', origin: '上海', destination: '北京' },
      { startDate: '2024-01-02', kind: 'stay', origin: '北京', destination: '北京' },
      { startDate: '2024-01-05', origin: '东京', destination: '京都' },
    )
    const gaps = computeContinuityGaps(list)
    expect(gaps).toHaveLength(1)
    expect(gaps[0].title).toBe('北京 → 东京')
  })

  it('连续行程没有断点', () => {
    const list = records(
      { startDate: '2024-01-01', origin: '上海', destination: '杭州' },
      { startDate: '2024-01-03', origin: '杭州', destination: '南京' },
      { startDate: '2024-01-05', origin: '南京', destination: '北京' },
    )
    expect(computeContinuityGaps(list)).toHaveLength(0)
  })
})
