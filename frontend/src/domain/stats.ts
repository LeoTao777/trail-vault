import { HOME_CITY } from '@/config'

import { chainSortSegs } from './chain'
import { cityKey, cityMeta, stripShi } from './city'
import { routeKey } from './filters'
import { dateRange, daysBetween, formatKm, formatNumber } from './format'
import { greatCircleKm } from './geo'
import { isMoveKind, kindColor, kindLabel } from './kind'
import type { TravelKind, TravelRecord } from './types'

/* ============================================================
 * 一、主页底部「指标条」：5 个指标，跟随当前筛选实时算
 * ============================================================ */

export interface Metrics {
  /** 在路天数：计入「在外过夜」的总天数（按日期去重） */
  days: number
  /** 可见花销：当前可见记录的金额合计 */
  amountCny: number
  /** 移动分钟数（有时长的飞行/铁路/地面水路累计） */
  durationMinutes: number
  /** (durationMinutes / 60).toFixed(1)，与旧版显示一致 */
  hours: string
  knownDurationCount: number
  movableCount: number
  /** 点亮城市（按原始城市名去重） */
  cities: string[]
  /** 待补字段数：缺时长 / 缺金额 / 证据未确认 */
  missing: number
  /** 指标副标题里「X 起」用的首条记录日期区间 */
  firstDateRange: string
}

/**
 * 5 个指标（旧版 renderStats）。
 *
 * 口径注意：`missing` 统计的是「当前这批记录」的缺口，换筛选数字会变 —— 不是 bug。
 */
export function computeMetrics(list: readonly TravelRecord[]): Metrics {
  const daySet = new Set<string>()
  const citySet = new Set<string>()
  let durationMinutes = 0
  let knownDurationCount = 0
  let movableCount = 0
  let amountCny = 0
  let missing = 0

  list.forEach((record) => {
    if (record.countsAsAway) {
      daysBetween(record.startDate, record.endDate).forEach((day) => daySet.add(day))
    }

    const movable = isMoveKind(record.kind)
    if (movable) movableCount += 1

    if (record.durationMinutes !== null && record.durationMinutes !== undefined) {
      durationMinutes += record.durationMinutes
      knownDurationCount += 1
    } else if (movable) {
      missing += 1
    }

    if (record.amountCny !== null && record.amountCny !== undefined) amountCny += record.amountCny
    else missing += 1

    if (record.confidence !== 'confirmed') missing += 1

    if (record.countsAsVisited) {
      ;[record.origin, record.destination].filter(Boolean).forEach((city) => citySet.add(city))
    }
  })

  return {
    days: daySet.size,
    amountCny,
    durationMinutes,
    hours: (durationMinutes / 60).toFixed(1),
    knownDurationCount,
    movableCount,
    cities: [...citySet],
    missing,
    firstDateRange: list.length ? dateRange(list[0]) : '无记录',
  }
}

/* ============================================================
 * 二、旅行档案：Hero 指标 + 6 个榜单（旧版 renderStatsPanel）
 * ============================================================ */

export interface CityRankEntry {
  name: string
  visits: number
  nights: number
}

export interface RouteRankEntry {
  name: string
  count: number
  /** 两端城市（去「市」，供跨榜 hover 联动） */
  cities: string[]
}

export interface CountRankEntry {
  name: string
  count: number
}

export interface YearRankEntry {
  year: string
  trips: number
  km: number
}

export interface KindRankEntry extends CountRankEntry {
  kind: TravelKind
  label: string
  color: string
}

export interface ArchiveStats {
  km: number
  kmText: string
  kmByKind: Record<'flight' | 'rail' | 'road', number>
  trips: number
  flights: number
  rails: number
  groundWater: number
  /** 城市 → 到访次数（原始城市名，含「市」变体） */
  cityVisits: Map<string, number>
  /** 城市（cityKey 归一）→ 累计停留夜数；含 HOME_CITY 互补口径 */
  cityNights: Map<string, number>
  countries: Map<string, number>
  continents: Map<string, number>
  cityRank: CityRankEntry[]
  routeRank: RouteRankEntry[]
  countryRank: CountRankEntry[]
  yearRank: YearRankEntry[]
  kindRank: KindRankEntry[]
  cityCount: number
  countryCount: number
  continentCount: number
}

/**
 * 档案页统计（跟随当前筛选）。
 *
 * 三个容易踩的口径，逐个写清楚：
 * 1. **到访城市按 Set 去重两端**：stay/门票记录 `origin === destination`，不去重会把同一城 +2，
 *    到访/国家/大洲全部虚高；
 * 2. **高频路线双向合并**：A↔B 算一条走廊 —— 有向拆分会把直觉里的次数稀释一半；
 * 3. **主城夜数用互补口径**：链式夜数对主城严重低估（链一断主城段就丢），
 *    改用「数据总跨度 − 在外地的夜数 − 在途夜数(粗略)」，且不覆盖已有的更大值。
 */
export function computeArchiveStats(list: readonly TravelRecord[]): ArchiveStats {
  const moves = list.filter((record) => isMoveKind(record.kind))

  let km = 0
  const kmByKind: Record<'flight' | 'rail' | 'road', number> = { flight: 0, rail: 0, road: 0 }
  moves.forEach((record) => {
    const distance = greatCircleKm(record.origin, record.destination)
    km += distance
    kmByKind[record.kind as 'flight' | 'rail' | 'road'] += distance
  })

  const cityVisits = new Map<string, number>()
  const routeCount = new Map<string, number>()
  const countries = new Map<string, number>()
  const continents = new Map<string, number>()

  list.forEach((record) => {
    if (!record.countsAsVisited) return

    new Set([record.origin, record.destination].filter(Boolean)).forEach((city) => {
      cityVisits.set(city, (cityVisits.get(city) || 0) + 1)
      const meta = cityMeta(city)
      countries.set(meta.country, (countries.get(meta.country) || 0) + 1)
      continents.set(meta.continent, (continents.get(meta.continent) || 0) + 1)
    })

    if (record.origin && record.destination && record.origin !== record.destination) {
      const key = routeKey(record.origin, record.destination)
      routeCount.set(key, (routeCount.get(key) || 0) + 1)
    }
  })

  // 每座城「待过多久」：到达某城（到达日）→ 下次从该城出发（出发日）的间隔即停留夜数，
  // 沿连续行程链累加；同日多段无时刻时用「链式贪心」排序，免得「A→B」「B→C」排反凭空制造断点。
  const cityNights = new Map<string, number>()
  const dwellSegs = chainSortSegs(
    list.filter(
      (record) =>
        isMoveKind(record.kind) &&
        record.countsAsVisited !== false &&
        record.origin &&
        record.destination &&
        cityKey(record.origin) !== cityKey(record.destination),
    ),
  )

  for (let i = 0; i < dwellSegs.length - 1; i += 1) {
    const current = dwellSegs[i]
    const next = dwellSegs[i + 1]
    if (cityKey(current.destination) === cityKey(next.origin)) {
      const nights = Math.max(0, daysBetween(current.endDate || current.startDate, next.startDate).length - 1)
      if (nights > 0) {
        const city = cityKey(current.destination)
        cityNights.set(city, (cityNights.get(city) || 0) + nights)
      }
    }
  }

  // 主城（HOME_CITY）：默认「不在外地的时间都在主城」。
  if (dwellSegs.length > 1) {
    const first = dwellSegs[0].startDate
    const last = dwellSegs[dwellSegs.length - 1].startDate
    const totalNights = Math.max(0, daysBetween(first, last).length - 1)
    let awayNights = 0
    cityNights.forEach((nights, city) => {
      if (city !== HOME_CITY) awayNights += nights
    })
    const homeNights = Math.max(
      cityNights.get(HOME_CITY) || 0,
      totalNights - awayNights - Math.round(dwellSegs.length * 0.25),
    )
    cityNights.set(HOME_CITY, homeNights)
  }

  // 城市排行：按累计停留夜数排序，无夜数（纯过境/断点）的城按到访次数兜底
  const cityAgg = [...cityVisits.entries()].map(([name, visits]) => ({
    name,
    visits,
    nights: cityNights.get(cityKey(name)) || 0,
  }))
  cityAgg.sort((a, b) => b.nights - a.nights || b.visits - a.visits)

  const routeRank: RouteRankEntry[] = [...routeCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count, cities: name.split(' ⇌ ').map((city) => stripShi(city)) }))

  const countryRank: CountRankEntry[] = [...countries.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }))

  // 年度足迹：每年出行次数 + 该年里程
  const yearAgg = new Map<string, { trips: number; km: number }>()
  moves.forEach((record) => {
    const year = String(record.startDate || '').slice(0, 4)
    if (!year) return
    const entry = yearAgg.get(year) || { trips: 0, km: 0 }
    entry.trips += 1
    entry.km += greatCircleKm(record.origin, record.destination)
    yearAgg.set(year, entry)
  })
  const yearRank: YearRankEntry[] = [...yearAgg.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, entry]) => ({ year, trips: entry.trips, km: entry.km }))

  // 出行方式：按交通工具分（退改不算出行方式）
  const kindAgg = new Map<string, number>()
  list.forEach((record) => kindAgg.set(record.kind, (kindAgg.get(record.kind) || 0) + 1))
  const kindRank: KindRankEntry[] = [...kindAgg.entries()]
    .filter(([kind]) => kind !== 'cancelled')
    .sort((a, b) => b[1] - a[1])
    .map(([kind, count]) => ({
      kind: kind as TravelKind,
      label: kindLabel(kind),
      color: kindColor(kind),
      count,
      name: kindLabel(kind),
    }))

  const flights = moves.filter((record) => record.kind === 'flight').length
  const rails = moves.filter((record) => record.kind === 'rail').length

  return {
    km,
    kmText: formatKm(km),
    kmByKind,
    trips: moves.length,
    flights,
    rails,
    groundWater: moves.length - flights - rails,
    cityVisits,
    cityNights,
    countries,
    continents,
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

/** 里程副标题：「飞行约X · 铁路约Y」（旧版 statKmSub）。 */
export function kmSubText(kmByKind: Record<'flight' | 'rail' | 'road', number>): string {
  return `飞行约${formatNumber(kmByKind.flight)} · 铁路约${formatNumber(kmByKind.rail)}`
}

/** 出行次数副标题：「航班X · 铁路Y · 地面/水路Z」。 */
export function tripsSubText(stats: Pick<ArchiveStats, 'flights' | 'rails' | 'groundWater'>): string {
  return `航班${stats.flights} · 铁路${stats.rails} · 地面/水路${stats.groundWater}`
}

/** 点亮城市副标题：前 3 座（旧版 statCitiesSub）。 */
export function citiesSubText(cities: Iterable<string>): string {
  return [...cities].slice(0, 3).join(' / ') || '—'
}

/** 国家副标题：前 4 个（旧版 statCountriesSub）。 */
export function countriesSubText(countries: Iterable<string>): string {
  return [...countries].slice(0, 4).join(' / ') || '—'
}

/** 大洲副标题：全部（旧版 statContinentsSub）。 */
export function continentsSubText(continents: Iterable<string>): string {
  return [...continents].join(' / ') || '—'
}
