import { CHINA_BOUNDS, WORLD_BOUNDS, type MapBounds, type MapViewScope } from '@/config'

import { CITY, cityLngLat } from './city'
import type { LngLat, TravelRecord } from './types'

const EARTH_RADIUS_KM = 6371

/**
 * 两城大圆距离（公里），用于累计里程。任一城市无坐标则返回 0。
 * 与旧版一致：只查内置 CITY 表（不做「去站名后缀」兜底），保证历史里程数字不变。
 */
export function greatCircleKm(a: string | undefined, b: string | undefined): number {
  const pa = CITY[String(a || '')]
  const pb = CITY[String(b || '')]
  if (!pa || !pb) return 0
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(pb.lat - pa.lat)
  const dLng = toRad(pb.lng - pa.lng)
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(pa.lat)) * Math.cos(toRad(pb.lat)) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(s))))
}

/** 两城大圆弧插值，给航线一点弧度（铁路有真实轨迹时不用它）。 */
export function geoArc(a: LngLat, b: LngLat, n = 48): LngLat[] {
  const toRad = (d: number) => (d * Math.PI) / 180
  const toDeg = (r: number) => (r * 180) / Math.PI
  const lon1 = toRad(a[0])
  const lat1 = toRad(a[1])
  const lon2 = toRad(b[0])
  const lat2 = toRad(b[1])
  const hav =
    Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2
  const d = 2 * Math.asin(Math.min(1, Math.sqrt(hav)))
  if (!d || !Number.isFinite(d)) return [a, b]
  const out: LngLat[] = []
  for (let i = 0; i <= n; i += 1) {
    const f = i / n
    const A = Math.sin((1 - f) * d) / Math.sin(d)
    const B = Math.sin(f * d) / Math.sin(d)
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2)
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2)
    const z = A * Math.sin(lat1) + B * Math.sin(lat2)
    out.push([toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)))])
  }
  return out
}

/** Web Mercator 归一化坐标（x ∈ [0,1]，y ∈ [0,1]），海报绘制用。 */
export function mercatorXY(lng: number, lat: number): [number, number] {
  const x = (lng + 180) / 360
  const s = Math.max(-0.9999, Math.min(0.9999, Math.sin((lat * Math.PI) / 180)))
  const y = 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)
  return [x, y]
}

export function inChinaBounds(lng: number, lat: number): boolean {
  return lng >= 73 && lng <= 135.2 && lat >= 17.5 && lat <= 54.5
}

export type BoundsTuple = [LngLat, LngLat]

/**
 * 按「实际去过的地方」算取景框：中国视图只框境内点（不为没去过的中亚留半屏空白），
 * 世界视图框全部点。补一点最小跨度，免得数据全挤在一两座城时镜头怼脸。
 *
 * 旧版签名是 dataBounds(scope)（读全局 filteredRecords），改造为显式传记录，便于单测。
 */
export function dataBounds(list: readonly TravelRecord[], scope: MapViewScope): BoundsTuple {
  let minLng = 999
  let minLat = 999
  let maxLng = -999
  let maxLat = -999
  let any = false

  list.forEach((record) => {
    if (record.countsAsVisited === false) return
    ;[record.origin, record.destination].forEach((city) => {
      const ll = cityLngLat(city)
      if (!ll) return
      if (scope === 'china' && !inChinaBounds(ll[0], ll[1])) return
      any = true
      minLng = Math.min(minLng, ll[0])
      maxLng = Math.max(maxLng, ll[0])
      minLat = Math.min(minLat, ll[1])
      maxLat = Math.max(maxLat, ll[1])
    })
  })

  if (!any) {
    const bounds: MapBounds = scope === 'world' ? WORLD_BOUNDS : CHINA_BOUNDS
    return [
      [bounds.minLng, bounds.minLat],
      [bounds.maxLng, bounds.maxLat],
    ]
  }

  const padLng = Math.max(1.2, (maxLng - minLng) * 0.06)
  const padLat = Math.max(1.0, (maxLat - minLat) * 0.06)
  return [
    [minLng - padLng, minLat - padLat],
    [maxLng + padLng, maxLat + padLat],
  ]
}

/** 把一批记录的坐标框在一起（时间线/城市点/选段镜头用），无坐标返回 null。 */
export function fitToRecords(list: readonly TravelRecord[]): BoundsTuple | null {
  let minLng = 999
  let minLat = 999
  let maxLng = -999
  let maxLat = -999
  let any = false
  list.forEach((record) => {
    ;[record.origin, record.destination].forEach((city) => {
      const ll = cityLngLat(city)
      if (!ll) return
      any = true
      minLng = Math.min(minLng, ll[0])
      maxLng = Math.max(maxLng, ll[0])
      minLat = Math.min(minLat, ll[1])
      maxLat = Math.max(maxLat, ll[1])
    })
  })
  return any
    ? [
        [minLng, minLat],
        [maxLng, maxLat],
      ]
    : null
}
