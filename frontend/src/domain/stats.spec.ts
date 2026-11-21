import { describe, expect, it } from 'vitest'

import { records } from '@/test/records'

import { greatCircleKm } from './geo'
import {
  citiesSubText,
  computeArchiveStats,
  computeMetrics,
  continentsSubText,
  countriesSubText,
  kmSubText,
  tripsSubText,
} from './stats'

/** 5 个指标的固定样例（数字刻意取整，方便人眼核对）。 */
const metricSample = () =>
  records(
    {
      startDate: '2024-01-01',
      endDate: '2024-01-01',
      kind: 'rail',
      origin: '上海',
      destination: '杭州',
      durationMinutes: 60,
      amountCny: 100,
      confidence: 'confirmed',
    },
    {
      startDate: '2024-01-01',
      endDate: '2024-01-03',
      kind: 'stay',
      origin: '杭州',
      destination: '杭州',
      durationMinutes: null,
      amountCny: 300,
      confidence: 'confirmed',
    },
    {
      startDate: '2024-01-03',
      endDate: '2024-01-03',
      kind: 'flight',
      origin: '杭州',
      destination: '上海',
      durationMinutes: null,
      amountCny: null,
      confidence: 'partial',
    },
  )

describe('computeMetrics：5 个指标', () => {
  const metrics = computeMetrics(metricSample())

  it('在路天数：countsAsAway 的日期去重后计数', () => {
    // 01-01（两段）+ 01-01~01-03（停留）+ 01-03 → 3 天
    expect(metrics.days).toBe(3)
    expect(metrics.firstDateRange).toBe('2024-01-01')
  })

  it('可见花销：只累加有金额的记录', () => {
    expect(metrics.amountCny).toBe(400)
  })

  it('移动小时：只有「有时长的移动段」进分子，副标题给出 x/y 段有时长', () => {
    expect(metrics.durationMinutes).toBe(60)
    expect(metrics.hours).toBe('1.0')
    expect(metrics.knownDurationCount).toBe(1)
    expect(metrics.movableCount).toBe(2)
  })

  it('点亮城市：countsAsVisited 的起讫城市去重', () => {
    expect(metrics.cities).toEqual(['上海', '杭州'])
  })

  it('待补字段：缺时长 + 缺金额 + 证据未确认（同一记录可叠加）', () => {
    // 航班：缺时长 1 + 缺金额 1 + partial 1 = 3
    expect(metrics.missing).toBe(3)
  })

  it('空列表不炸，显示「无记录」', () => {
    const empty = computeMetrics([])
    expect(empty.days).toBe(0)
    expect(empty.amountCny).toBe(0)
    expect(empty.hours).toBe('0.0')
    expect(empty.cities).toEqual([])
    expect(empty.missing).toBe(0)
    expect(empty.firstDateRange).toBe('无记录')
  })
})

/** 档案页样例 A：4 段单程，覆盖断点链与「桥接式」夜数累计。 */
const archiveSampleA = () =>
  records(
    { startDate: '2024-01-01', endDate: '2024-01-01', origin: '上海', destination: '杭州' },
    { startDate: '2024-01-03', endDate: '2024-01-03', origin: '杭州', destination: '南京' },
    { startDate: '2024-01-05', endDate: '2024-01-05', origin: '南京', destination: '北京' },
    { startDate: '2024-02-01', endDate: '2024-02-01', origin: '北京', destination: '上海' },
  )

describe('computeArchiveStats：Hero 指标与 6 个榜单', () => {
  const list = archiveSampleA()
  const stats = computeArchiveStats(list)

  it('里程 = 各移动段大圆距离之和，且按方式拆分', () => {
    const expected = list.reduce((sum, record) => sum + greatCircleKm(record.origin, record.destination), 0)
    expect(stats.km).toBe(expected)
    expect(stats.kmByKind.flight).toBe(0)
    expect(stats.kmByKind.rail).toBe(expected)
    expect(stats.kmByKind.road).toBe(0)
    expect(stats.kmText).toBe(
      expected >= 10000 ? `${(expected / 10000).toFixed(1)}万` : expected.toLocaleString('en-US'),
    )
  })

  it('出行次数与方式拆分', () => {
    expect(stats.trips).toBe(4)
    expect(stats.flights).toBe(0)
    expect(stats.rails).toBe(4)
    expect(stats.groundWater).toBe(0)
    expect(tripsSubText(stats)).toBe('航班0 · 铁路4 · 地面/水路0')
    expect(kmSubText(stats.kmByKind)).toContain('飞行约0 · 铁路约')
  })

  it('城市到访：两端 Set 去重后计数', () => {
    expect(Object.fromEntries(stats.cityVisits)).toEqual({ 上海: 2, 杭州: 2, 南京: 2, 北京: 2 })
    expect(stats.cityCount).toBe(4)
    expect(citiesSubText(stats.cityVisits.keys())).toBe('上海 / 杭州 / 南京')
  })

  it('城市夜数：链式累计「到达→下次离开」', () => {
    // 杭州 01-01→01-03 = 2 晚；南京 01-03→01-05 = 2 晚；北京 01-05→02-01 = 27 晚
    expect(stats.cityNights.get('杭州')).toBe(2)
    expect(stats.cityNights.get('南京')).toBe(2)
    expect(stats.cityNights.get('北京')).toBe(27)
    // 主城互补口径：总跨度 31 晚 − 在外 31 晚 − 在途(round(4*0.25)=1) → 不低于 0
    expect(stats.cityNights.get('上海')).toBe(0)
  })

  it('城市榜按夜数排、夜数相同按到访次数、无夜数的城按到访次数兜底', () => {
    expect(stats.cityRank.map((entry) => [entry.name, entry.nights, entry.visits])).toEqual([
      ['北京', 27, 2],
      ['杭州', 2, 2],
      ['南京', 2, 2],
      ['上海', 0, 2],
    ])
  })

  it('高频路线双向合并（A⇌B 算一条走廊），计数降序', () => {
    expect(stats.routeRank.map((entry) => [entry.name, entry.count])).toEqual([
      ['上海 ⇌ 杭州', 1],
      ['南京 ⇌ 杭州', 1],
      ['北京 ⇌ 南京', 1],
      ['上海 ⇌ 北京', 1],
    ])
    expect(stats.routeRank[0].cities).toEqual(['上海', '杭州'])
  })

  it('国家 / 大洲榜（未收录城市默认中国大陆 · 亚洲）', () => {
    expect(stats.countryRank).toEqual([{ name: '中国', count: 8 }])
    expect(stats.countryCount).toBe(1)
    expect(Object.fromEntries(stats.continents)).toEqual({ 亚洲: 8 })
    expect(stats.continentCount).toBe(1)
    expect(countriesSubText(stats.countries.keys())).toBe('中国')
    expect(continentsSubText(stats.continents.keys())).toBe('亚洲')
  })

  it('年度榜：每年出行次数 + 该年里程，年份倒序', () => {
    expect(stats.yearRank).toHaveLength(1)
    expect(stats.yearRank[0].year).toBe('2024')
    expect(stats.yearRank[0].trips).toBe(4)
    expect(stats.yearRank[0].km).toBe(stats.km)
  })

  it('出行方式榜：退改不参与，按次数降序', () => {
    expect(stats.kindRank.map((entry) => [entry.kind, entry.count])).toEqual([['rail', 4]])
    expect(stats.kindRank[0].label).toBe('铁路')
    expect(stats.kindRank[0].color).toBe('var(--rail)')
  })
})

describe('主城（HOME_CITY）互补口径', () => {
  it('链一断主城段会丢，改用「总跨度 − 在外夜数 − 在途」补回', () => {
    const stats = computeArchiveStats(
      records(
        { startDate: '2024-01-01', endDate: '2024-01-02', origin: '上海', destination: '杭州' },
        { startDate: '2024-01-03', endDate: '2024-01-04', origin: '杭州', destination: '上海' },
        { startDate: '2024-02-01', endDate: '2024-02-02', origin: '上海', destination: '北京' },
      ),
    )

    // 链式只给出上海 28 晚；互补口径 31 − 1（杭州）− 1（在途）= 29 晚更大，取 29
    expect(stats.cityNights.get('上海')).toBe(29)
    expect(stats.cityNights.get('杭州')).toBe(1)
    expect(stats.cityRank.map((entry) => entry.name)).toEqual(['上海', '杭州', '北京'])
    expect(stats.cityRank[0]).toMatchObject({ name: '上海', nights: 29, visits: 2 })
  })
})

describe('档案统计的其它口径', () => {
  it('停留/门票记录 origin===destination 只给该城 +1 次（不去重会虚高）', () => {
    const stats = computeArchiveStats(
      records(
        { startDate: '2024-01-01', endDate: '2024-01-03', kind: 'stay', origin: '杭州', destination: '杭州' },
        { startDate: '2024-01-03', endDate: '2024-01-03', origin: '上海', destination: '杭州' },
      ),
    )
    expect(stats.cityVisits.get('杭州')).toBe(2)
    expect(stats.cityVisits.get('上海')).toBe(1)
    expect(stats.countries.get('中国')).toBe(3)
  })

  it('退改记录保留在数据里，但不计入出行次数与方式榜', () => {
    const stats = computeArchiveStats(
      records(
        { startDate: '2024-01-01', origin: '上海', destination: '北京' },
        {
          startDate: '2024-01-02',
          kind: 'cancelled',
          origin: '北京',
          destination: '上海',
          countsAsAway: false,
          countsAsVisited: false,
        },
      ),
    )
    expect(stats.trips).toBe(1)
    expect(stats.kindRank.map((entry) => entry.kind)).toEqual(['rail'])
    expect(stats.cityVisits.get('上海')).toBe(1)
  })

  it('海外城市计入对应国家与大洲', () => {
    const stats = computeArchiveStats(
      records(
        { startDate: '2024-01-01', origin: '上海', destination: '巴黎' },
        { startDate: '2024-01-05', origin: '巴黎', destination: '上海' },
      ),
    )
    expect(stats.countryCount).toBe(2)
    expect(stats.countries.get('法国')).toBe(2)
    expect(stats.continentCount).toBe(2)
    expect(stats.continents.get('欧洲')).toBe(2)
  })

  it('空筛选不炸', () => {
    const stats = computeArchiveStats([])
    expect(stats.km).toBe(0)
    expect(stats.trips).toBe(0)
    expect(stats.cityRank).toEqual([])
    expect(stats.kindRank).toEqual([])
    expect(stats.cityCount).toBe(0)
  })

  it('指标条与档案榜共用同一份「到访城市」口径', () => {
    const list = records(
      { startDate: '2024-01-01', kind: 'stay', origin: '杭州', destination: '杭州' },
      { startDate: '2024-01-03', origin: '上海', destination: '杭州' },
    )
    const metrics = computeMetrics(list)
    const stats = computeArchiveStats(list)
    expect(new Set(metrics.cities)).toEqual(new Set(stats.cityVisits.keys()))
    expect(metrics.missing).toBeGreaterThan(0)
  })
})
