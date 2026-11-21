import { describe, expect, it } from 'vitest'

import { fallbackRecords } from '@/data/fallbackRecords'
import { HOME_CITY } from '@/config'

import { computeContinuityGaps } from './chain'
import { CITY_ALIAS, cityMeta } from './city'
import { DEFAULT_FILTERS, filterRecords, filteredRecords, type Filters } from './filters'
import { greatCircleKm } from './geo'
import { normalize } from './normalize'
import { computeArchiveStats, computeMetrics } from './stats'
import type { TravelRecord } from './types'

/**
 * P1 验收：「同一份数据，新 domain 输出与旧版页面显示的数字逐项一致」。
 *
 * 做法：把旧版 app.js 里的算法**独立重写**一遍（不复用 src/domain 的实现，连日期枚举都换成
 * UTC 算法），再拿真实的演示数据集跑差分对比。这样不需要在测试里写死一坨数字，
 * 也能在任何人改动口径时立刻炸出来。
 *
 * 真实数据集上的历史数字由 P7 的 parity QA（新旧页面并排对跑）做最终确认。
 */

const dataset = normalize(fallbackRecords)

/* ——— 参考实现 1：日期枚举（UTC 算法，与生产实现的本地 Date 迭代独立） ——— */
function refDayList(start: string, end?: string): string[] {
  const parse = (value: string) => {
    const [year, month, day] = value.split('-').map(Number)
    if (!year || !month || !day) return Number.NaN
    return Date.UTC(year, month - 1, day)
  }
  const from = parse(start)
  const to = parse(end || start)
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return []
  const days: string[] = []
  for (let time = from; time <= to; time += 86_400_000) {
    days.push(new Date(time).toISOString().slice(0, 10))
  }
  return days
}

const isMove = (kind: string) => kind === 'flight' || kind === 'rail' || kind === 'road'

/* ——— 参考实现 2：5 个指标 ——— */
function refMetrics(list: readonly TravelRecord[]) {
  const days = new Set<string>()
  const cities = new Set<string>()
  let amountCny = 0
  let durationMinutes = 0
  let knownDurationCount = 0
  let movableCount = 0
  let missing = 0

  for (const record of list) {
    if (record.countsAsAway && record.startDate) {
      refDayList(record.startDate, record.endDate).forEach((day) => days.add(day))
    }
    if (isMove(record.kind)) movableCount += 1
    if (record.durationMinutes !== null && record.durationMinutes !== undefined) {
      durationMinutes += record.durationMinutes
      knownDurationCount += 1
    } else if (isMove(record.kind)) missing += 1
    if (record.amountCny !== null && record.amountCny !== undefined) amountCny += record.amountCny
    else missing += 1
    if (record.confidence !== 'confirmed') missing += 1
    if (record.countsAsVisited) {
      if (record.origin) cities.add(record.origin)
      if (record.destination) cities.add(record.destination)
    }
  }

  return {
    days: days.size,
    amountCny,
    durationMinutes,
    hours: (durationMinutes / 60).toFixed(1),
    knownDurationCount,
    movableCount,
    cities: [...cities],
    missing,
  }
}

/* ——— 参考实现 3：同日链式排序（按日期分桶写法，与生产实现的游标写法独立） ——— */
const refNormCity = (city?: string) => {
  const clean = String(city || '')
    .trim()
    .replace(/市$/, '')
  return CITY_ALIAS[clean] || clean
}

function refChainSort(segs: readonly TravelRecord[]): TravelRecord[] {
  const sorted = [...segs].sort(
    (a, b) =>
      String(a.startDate || '').localeCompare(String(b.startDate || '')) ||
      String(a.departTime || '').localeCompare(String(b.departTime || '')),
  )

  const buckets = new Map<string, TravelRecord[]>()
  for (const seg of sorted) {
    const key = String(seg.startDate)
    const bucket = buckets.get(key)
    if (bucket) bucket.push(seg)
    else buckets.set(key, [seg])
  }

  const out: TravelRecord[] = []
  for (const bucket of buckets.values()) {
    if (bucket.length > 1 && bucket.some((seg) => !seg.departTime)) {
      let current: string | null = out.length ? refNormCity(out[out.length - 1].destination) : null
      const pool = bucket.slice()
      while (pool.length) {
        const index = current ? pool.findIndex((seg) => refNormCity(seg.origin) === current) : -1
        const next = index >= 0 ? pool.splice(index, 1)[0] : pool.shift()
        if (!next) break
        out.push(next)
        current = refNormCity(next.destination)
      }
    } else {
      out.push(...bucket)
    }
  }
  return out
}

function refGapCount(list: readonly TravelRecord[]): number {
  const segs = refChainSort(
    list.filter(
      (record) =>
        isMove(record.kind) &&
        record.countsAsVisited !== false &&
        Boolean(record.origin) &&
        Boolean(record.destination) &&
        refNormCity(record.origin) !== refNormCity(record.destination),
    ),
  )
  const border = new Set(['深圳|香港', '香港|深圳', '珠海|澳门', '澳门|珠海'])
  let count = 0
  for (let i = 0; i < segs.length - 1; i += 1) {
    const arrived = refNormCity(segs[i].destination)
    const departed = refNormCity(segs[i + 1].origin)
    if (border.has(`${arrived}|${departed}`)) continue
    if (
      arrived !== departed &&
      segs[i + 1].startDate &&
      segs[i + 1].startDate !== (segs[i].endDate || segs[i].startDate)
    ) {
      count += 1
    }
  }
  return count
}

/* ——— 参考实现 4：档案页 Hero 指标 + 6 个榜 ——— */
function refArchive(list: readonly TravelRecord[]) {
  const cityVisits = new Map<string, number>()
  const routeCount = new Map<string, number>()
  const countries = new Map<string, number>()
  const continents = new Map<string, number>()
  const kmByKind = { flight: 0, rail: 0, road: 0 }
  let km = 0
  let trips = 0
  let flights = 0
  let rails = 0

  for (const record of list) {
    if (isMove(record.kind)) {
      trips += 1
      if (record.kind === 'flight') flights += 1
      if (record.kind === 'rail') rails += 1
      const distance = greatCircleKm(record.origin, record.destination)
      km += distance
      kmByKind[record.kind as 'flight' | 'rail' | 'road'] += distance
    }

    if (!record.countsAsVisited) continue

    const ends = new Set([record.origin, record.destination].filter(Boolean))
    ends.forEach((city) => {
      cityVisits.set(city, (cityVisits.get(city) || 0) + 1)
      const meta = cityMeta(city)
      countries.set(meta.country, (countries.get(meta.country) || 0) + 1)
      continents.set(meta.continent, (continents.get(meta.continent) || 0) + 1)
    })

    if (record.origin && record.destination && record.origin !== record.destination) {
      const pair = [record.origin, record.destination].map((city) => city.replace(/市$/, '')).sort()
      const key = `${pair[0]} ⇌ ${pair[1]}`
      routeCount.set(key, (routeCount.get(key) || 0) + 1)
    }
  }

  // 城市夜数（链式 + 主城互补）
  const cityNights = new Map<string, number>()
  const dwellSegs = refChainSort(
    list.filter(
      (record) =>
        isMove(record.kind) &&
        record.countsAsVisited !== false &&
        Boolean(record.origin) &&
        Boolean(record.destination) &&
        refNormCity(record.origin) !== refNormCity(record.destination),
    ),
  )
  for (let i = 0; i < dwellSegs.length - 1; i += 1) {
    if (refNormCity(dwellSegs[i].destination) === refNormCity(dwellSegs[i + 1].origin)) {
      const nights = Math.max(
        0,
        refDayList(dwellSegs[i].endDate || dwellSegs[i].startDate, dwellSegs[i + 1].startDate).length - 1,
      )
      if (nights > 0) {
        const city = refNormCity(dwellSegs[i].destination)
        cityNights.set(city, (cityNights.get(city) || 0) + nights)
      }
    }
  }
  if (dwellSegs.length > 1) {
    const first = dwellSegs[0].startDate
    const last = dwellSegs[dwellSegs.length - 1].startDate
    const totalNights = Math.max(0, refDayList(first, last).length - 1)
    let away = 0
    cityNights.forEach((nights, city) => {
      if (city !== HOME_CITY) away += nights
    })
    const home = Math.max(
      cityNights.get(HOME_CITY) || 0,
      totalNights - away - Math.round(dwellSegs.length * 0.25),
    )
    cityNights.set(HOME_CITY, home)
  }

  const cityAgg = [...cityVisits.entries()].map(([name, visits]) => ({
    name,
    visits,
    nights: cityNights.get(refNormCity(name)) || 0,
  }))
  cityAgg.sort((a, b) => b.nights - a.nights || b.visits - a.visits)

  const routeRank = [...routeCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({
      name,
      count,
      cities: name.split(' ⇌ ').map((city) => city.replace(/市$/, '')),
    }))

  const countryRank = [...countries.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }))

  const yearAgg = new Map<string, { trips: number; km: number }>()
  list.forEach((record) => {
    if (!isMove(record.kind)) return
    const year = String(record.startDate || '').slice(0, 4)
    if (!year) return
    const entry = yearAgg.get(year) || { trips: 0, km: 0 }
    entry.trips += 1
    entry.km += greatCircleKm(record.origin, record.destination)
    yearAgg.set(year, entry)
  })
  const yearRank = [...yearAgg.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, entry]) => ({ year, trips: entry.trips, km: entry.km }))

  const kindAgg = new Map<string, number>()
  list.forEach((record) => kindAgg.set(record.kind, (kindAgg.get(record.kind) || 0) + 1))
  const kindRank = [...kindAgg.entries()]
    .filter(([kind]) => kind !== 'cancelled')
    .sort((a, b) => b[1] - a[1])
    .map(([kind, count]) => ({ kind, count }))

  return {
    km,
    kmByKind,
    trips,
    flights,
    rails,
    groundWater: trips - flights - rails,
    cityVisits: Object.fromEntries(cityVisits),
    cityNights: Object.fromEntries(cityNights),
    countries: Object.fromEntries(countries),
    continents: Object.fromEntries(continents),
    cityRank: cityAgg.slice(0, 10),
    routeRank,
    countryRank,
    yearRank,
    kindRank,
    cityCount: cityVisits.size,
    countryCount: countries.size,
    continentCount: continents.size,
  }
}

/* ——— 参考实现 5：筛选（含旅客归属，不含缺口注入） ——— */
function refFilter(list: readonly TravelRecord[], active: Filters): TravelRecord[] {
  return list.filter((record) => {
    if (active.year !== 'all' && !String(record.startDate || '').startsWith(active.year)) return false
    if (active.kind !== 'all' && record.kind !== active.kind) return false
    if (active.confidence !== 'all' && record.confidence !== active.confidence) return false
    if (active.traveler === 'all') return true
    const people = record.people || []
    const needle = active.traveler === 'self' ? 'Nova Kepler' : active.traveler
    return record.traveler.includes(needle) || people.includes(needle)
  })
}

/** 参与差分对比的筛选组合（不含 pending：那条路径会额外注入断点）。 */
const FILTER_COMBOS: Filters[] = [
  DEFAULT_FILTERS,
  { ...DEFAULT_FILTERS, traveler: 'all' },
  { ...DEFAULT_FILTERS, traveler: 'all', year: '2024' },
  { ...DEFAULT_FILTERS, traveler: 'all', kind: 'flight' },
  { ...DEFAULT_FILTERS, traveler: 'all', kind: 'rail', confidence: 'confirmed' },
  { ...DEFAULT_FILTERS, traveler: 'all', confidence: 'partial' },
  { ...DEFAULT_FILTERS, traveler: 'all', confidence: 'inferred' },
]

describe('真实演示数据集：与旧版算法逐项对齐', () => {
  it('数据集本身可用（条数、id 唯一、按开始日期升序）', () => {
    expect(dataset.length).toBeGreaterThan(50)
    expect(new Set(dataset.map((record) => record.id)).size).toBe(dataset.length)
    const dates = dataset.map((record) => String(record.startDate || ''))
    expect(dates).toEqual([...dates].sort())
    expect(
      dataset.every((record) =>
        ['flight', 'rail', 'road', 'stay', 'cancelled', 'other'].includes(record.kind),
      ),
    ).toBe(true)
  })

  it('5 个指标：在路天数 / 可见花销 / 移动小时 / 点亮城市 / 待补字段', () => {
    const actual = computeMetrics(dataset)
    expect({
      days: actual.days,
      amountCny: actual.amountCny,
      durationMinutes: actual.durationMinutes,
      hours: actual.hours,
      knownDurationCount: actual.knownDurationCount,
      movableCount: actual.movableCount,
      cities: actual.cities,
      missing: actual.missing,
    }).toEqual(refMetrics(dataset))
  })

  it('档案页 Hero 指标 + 6 个榜 + 城市夜数（含主城互补口径）', () => {
    const stats = computeArchiveStats(dataset)
    const expected = refArchive([...dataset])

    expect({
      km: stats.km,
      kmByKind: stats.kmByKind,
      trips: stats.trips,
      flights: stats.flights,
      rails: stats.rails,
      groundWater: stats.groundWater,
      cityVisits: Object.fromEntries(stats.cityVisits),
      cityNights: Object.fromEntries(stats.cityNights),
      countries: Object.fromEntries(stats.countries),
      continents: Object.fromEntries(stats.continents),
      cityRank: stats.cityRank,
      routeRank: stats.routeRank,
      countryRank: stats.countryRank,
      yearRank: stats.yearRank,
      kindRank: stats.kindRank.map((entry) => ({ kind: entry.kind, count: entry.count })),
      cityCount: stats.cityCount,
      countryCount: stats.countryCount,
      continentCount: stats.continentCount,
    }).toEqual(expected)
  })

  it('筛选组合：可见记录与旧版一致（年份 / 旅客 / 类型 / 证据）', () => {
    FILTER_COMBOS.forEach((active) => {
      const actual = filterRecords(dataset, active).map((record) => record.id)
      const expected = refFilter(dataset, active).map((record) => record.id)
      expect(expected).toEqual(actual)
    })
  })

  it('筛选组合下的 5 个指标与旧版一致（同一批数据、不同口径）', () => {
    FILTER_COMBOS.forEach((active) => {
      const visible = filteredRecords(dataset, active)
      const actual = computeMetrics(visible)
      const expected = refMetrics(refFilter(dataset, active))
      expect({
        days: actual.days,
        amountCny: actual.amountCny,
        durationMinutes: actual.durationMinutes,
        hours: actual.hours,
        knownDurationCount: actual.knownDurationCount,
        movableCount: actual.movableCount,
        cities: actual.cities,
        missing: actual.missing,
      }).toEqual(expected)
    })
  })

  it('筛选组合下的 6 个榜单与旧版一致（以 2024 年、全部旅客为例）', () => {
    const active: Filters = { ...DEFAULT_FILTERS, traveler: 'all', year: '2024' }
    const visible = filteredRecords(dataset, active)
    const stats = computeArchiveStats(visible)
    const expected = refArchive(refFilter(dataset, active))

    expect({
      km: stats.km,
      trips: stats.trips,
      cityVisits: Object.fromEntries(stats.cityVisits),
      cityNights: Object.fromEntries(stats.cityNights),
      cityRank: stats.cityRank,
      routeRank: stats.routeRank,
      countryRank: stats.countryRank,
      yearRank: stats.yearRank,
      kindRank: stats.kindRank.map((entry) => ({ kind: entry.kind, count: entry.count })),
    }).toEqual({
      km: expected.km,
      trips: expected.trips,
      cityVisits: expected.cityVisits,
      cityNights: expected.cityNights,
      cityRank: expected.cityRank,
      routeRank: expected.routeRank,
      countryRank: expected.countryRank,
      yearRank: expected.yearRank,
      kindRank: expected.kindRank,
    })
  })

  it('断点条数：与旧版「到达地 ≠ 下一段出发地」口径一致', () => {
    expect(computeContinuityGaps(dataset)).toHaveLength(refGapCount(dataset))
  })

  it('断点占位条目的口径（不点亮、不写库、不进统计）', () => {
    const gaps = computeContinuityGaps(dataset)
    expect(gaps.length).toBeGreaterThan(0)
    expect(new Set(gaps.map((gap) => gap.id)).size).toBe(gaps.length)

    gaps.forEach((gap) => {
      expect(gap._gap).toBe(true)
      expect(gap.confidence).toBe('pending')
      expect(gap.countsAsVisited).toBe(false)
      expect(gap.countsAsAway).toBe(false)
      expect(gap.showInTimeline).toBe(true)
      expect(gap.amountCny).toBeNull()
      expect(gap.durationMinutes).toBeNull()
      expect(gap.origin).not.toBe(gap.destination)
      expect(gap.startDate).not.toBe(gap.endDate)
    })

    // 口岸往返不产生假缺口
    const border = new Set(['深圳 → 香港', '香港 → 深圳', '珠海 → 澳门', '澳门 → 珠海'])
    expect(gaps.some((gap) => border.has(gap.title))).toBe(false)
  })

  it('pending 筛选 = 待补记录 + 动态缺口；其它筛选不注入缺口', () => {
    const clean = filteredRecords(dataset, { ...DEFAULT_FILTERS, traveler: 'all' })
    expect(clean.some((record) => record._gap)).toBe(false)

    const pending = filteredRecords(dataset, { ...DEFAULT_FILTERS, traveler: 'all', confidence: 'pending' })
    const pendingRecords = dataset.filter((record) => record.confidence === 'pending')
    const gaps = computeContinuityGaps(dataset)
    expect(pending.filter((record) => record._gap)).toHaveLength(gaps.length)
    expect(pending).toHaveLength(pendingRecords.length + gaps.length)
  })
})
