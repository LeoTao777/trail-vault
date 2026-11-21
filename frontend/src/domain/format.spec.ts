import { describe, expect, it } from 'vitest'

import { records } from '@/test/records'

import {
  dateRange,
  daysBetween,
  displayTitle,
  duration,
  formatKm,
  formatNumber,
  isCrossTimezone,
  money,
  stayNights,
  tripTimeText,
} from './format'

describe('daysBetween', () => {
  it('含首尾逐天枚举', () => {
    expect(daysBetween('2024-01-01', '2024-01-03')).toEqual(['2024-01-01', '2024-01-02', '2024-01-03'])
    expect(daysBetween('2024-01-01', '2024-01-01')).toEqual(['2024-01-01'])
  })

  it('end 早于 start / 无 start / 非法日期都返回空数组', () => {
    expect(daysBetween('2024-01-03', '2024-01-01')).toEqual([])
    expect(daysBetween(undefined, '2024-01-01')).toEqual([])
    expect(daysBetween('bad-date', '2024-01-01')).toEqual([])
  })

  it('跨月跨年也连续', () => {
    const days = daysBetween('2023-12-30', '2024-01-02')
    expect(days).toEqual(['2023-12-30', '2023-12-31', '2024-01-01', '2024-01-02'])
  })
})

describe('dateRange / displayTitle / stayNights', () => {
  it('单日不显示波浪号，缺日期显示 -', () => {
    const [sameDay, range] = records(
      { startDate: '2024-01-01', endDate: '2024-01-01' },
      { startDate: '2024-01-01', endDate: '2024-01-03' },
    )
    expect(dateRange(sameDay)).toBe('2024-01-01')
    expect(dateRange(range)).toBe('2024-01-01 ~ 2024-01-03')
    expect(dateRange(null)).toBe('-')
    expect(dateRange({ startDate: '', endDate: '' })).toBe('-')
  })

  it('标题里的 `->` 归一成箭头；stay 的「X → X」统一成「X停留」', () => {
    const [flight, stay, other] = records(
      { startDate: '2024-01-01', kind: 'flight', title: '上海 -> 东京' },
      { startDate: '2024-01-01', kind: 'stay', title: '深圳市 → 深圳' },
      { startDate: '2024-01-01', kind: 'stay', title: '杭州停留' },
    )
    expect(displayTitle(flight)).toBe('上海 → 东京')
    expect(displayTitle(stay)).toBe('深圳停留')
    expect(displayTitle(other)).toBe('杭州停留')
  })

  it('stayNights = 含首尾日数 − 1', () => {
    expect(stayNights({ startDate: '2024-01-01', endDate: '2024-01-01' })).toBe(0)
    expect(stayNights({ startDate: '2024-01-01', endDate: '2024-01-03' })).toBe(2)
  })
})

describe('money / duration 的展示模式', () => {
  it('金额千分位，空值在工作台喊「待补」、展示模式安静省略', () => {
    expect(money(1280)).toBe('¥1,280')
    expect(money(0)).toBe('¥0')
    expect(money(1280.5)).toBe('¥1,280.5')
    expect(money(null)).toBe('待补')
    expect(money(undefined)).toBe('待补')
    expect(money(null, true)).toBe('')
  })

  it('时长文案', () => {
    expect(duration(0)).toBe('0 分')
    expect(duration(45)).toBe('45 分')
    expect(duration(60)).toBe('1 小时')
    expect(duration(150)).toBe('2 小时 30 分')
    expect(duration(null)).toBe('待补')
    expect(duration(null, true)).toBe('')
  })
})

describe('isCrossTimezone', () => {
  it('港澳算国内，日本/法国算跨境', () => {
    expect(isCrossTimezone({ origin: '上海', destination: '杭州' })).toBe(false)
    expect(isCrossTimezone({ origin: '深圳', destination: '中国香港' })).toBe(false)
    expect(isCrossTimezone({ origin: '上海', destination: '东京' })).toBe(true)
    expect(isCrossTimezone({ origin: '巴黎', destination: '上海' })).toBe(true)
  })
})

describe('tripTimeText', () => {
  it('同日航班只显示时刻区间', () => {
    const [record] = records({
      startDate: '2024-01-01',
      origin: '上海',
      destination: '杭州',
      departTime: '09:00',
      arriveTime: '10:00',
    })
    expect(tripTimeText(record)).toBe('09:00–10:00')
  })

  it('跨夜的「到达 < 出发」补 +1天，跨境再补「当地」', () => {
    const [record] = records({
      startDate: '2024-01-01',
      endDate: '2024-01-01',
      kind: 'flight',
      origin: '上海',
      destination: '东京',
      departTime: '12:00',
      arriveTime: '06:00',
    })
    expect(tripTimeText(record)).toBe('12:00–06:00 +1天 当地')
  })

  it('停留段按日期跨度给 +N天', () => {
    const [record] = records({
      startDate: '2024-01-01',
      endDate: '2024-01-03',
      kind: 'stay',
      origin: '杭州',
      destination: '杭州',
      departTime: '15:00',
      arriveTime: '12:00',
    })
    expect(tripTimeText(record)).toBe('15:00–12:00 +2天')
  })

  it('移动段日期跨度异常大（合并录入）不显示夸张的 +N天', () => {
    const [record] = records({
      startDate: '2024-01-01',
      endDate: '2024-01-10',
      kind: 'flight',
      origin: '上海',
      destination: '东京',
      departTime: '09:00',
      arriveTime: '10:00',
    })
    expect(tripTimeText(record)).toBe('09:00–10:00 当地')
  })

  it('只有一个时刻就只显示那个；两个都没有返回空串', () => {
    const [departOnly, none] = records(
      { startDate: '2024-01-01', departTime: '09:00' },
      { startDate: '2024-01-01' },
    )
    expect(tripTimeText(departOnly)).toBe('09:00')
    expect(tripTimeText(none)).toBe('')
  })
})

describe('数字格式化', () => {
  it('千分位与「万」', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
    expect(formatKm(9999)).toBe('9,999')
    expect(formatKm(12345)).toBe('1.2万')
  })
})
