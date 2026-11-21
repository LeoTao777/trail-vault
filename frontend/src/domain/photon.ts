import { USER_CITY_KEY } from '@/config'

import { cityLngLat, continentOf, registerCity, stripShi } from './city'

/**
 * 地点地理编码：让任意真实地点都能录入（国内乡镇 + 海外）。
 *
 * 用公开的 Photon（基于 OpenStreetMap）检索，无需 key、支持跨域。
 * 解析到的坐标通过 registerCity() 并入城市表，并存到 localStorage，下次仍可用。
 */

export interface PlaceCandidate {
  name: string
  lat: number
  lng: number
  /** 中国内地（含港澳台）*/
  domestic: boolean
  /** 「省 · 市」或「地区 · 国家」说明，可能为空 */
  ctx: string
  country: string
  cont: { key: string; zh: string }
  /** 拉丁名（全大写），没有则为空串 */
  en: string
  _rank: number
  _i: number
}

// 一葳能读拉丁 + 中文/日文汉字假名；阿拉伯/希伯来/西里尔/泰/希腊/亚美尼亚/谚文/印度系等 → 看不懂，换英文。
const NON_READABLE = /[֐-׿؀-ۿݐ-ݿЀ-ԯ฀-๿Ͱ-Ͽ԰-֏가-힯ᄀ-ᇿ㄰-㆏ऀ-෿]/

export function preferReadable(local: string | undefined, en: string | undefined): string {
  const text = local || ''
  return text && !NON_READABLE.test(text) ? text : en || text
}

// 候选排序权重：行政地名（市/县/镇…）排前，景点/街道/建筑等 POI 往后（要找 POI 直接搜它的名字）。
const PLACE_ORDER: Record<string, number> = {
  country: 11,
  continent: 10,
  city: 8,
  municipality: 8,
  town: 7,
  county: 7,
  prefecture: 7,
  district: 6,
  province: 6,
  state: 6,
  region: 6,
  island: 5,
  suburb: 5,
  borough: 5,
  village: 5,
  hamlet: 4,
  locality: 4,
  quarter: 3,
  neighbourhood: 3,
}

function placeRank(props: Record<string, unknown>, query: string): number {
  let score: number
  if (props.osm_key === 'place') score = 30 + (PLACE_ORDER[String(props.osm_value)] || 2)
  else if (props.osm_key === 'boundary' && props.osm_value === 'administrative') score = 28
  else score = 6 // amenity/tourism/highway/building/railway… = POI，靠后
  if (props.name && props.name === query) score += 2 // 名称恰好等于搜索词，微弱加权
  return score
}

interface PhotonFeature {
  geometry?: { type?: string; coordinates?: [number, number] }
  properties?: Record<string, unknown>
}

/**
 * Photon 检索 → 候选数组。同时取 default(本地名) 与 en(英文名)：本地名可读（中文/日文/拉丁）就用本地名，
 * 不可读（阿拉伯/西里尔/泰…）就退英文。每条带「省·市/县（中国）」或「地区·国家（海外）」+ 中国/大洲标记 + 真实坐标。
 * 结果按行政级别排序：地级市/县/镇在前，景点/街道在后。
 */
export async function photonSearch(
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PlaceCandidate[]> {
  const base = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=12`
  const grab = (lang: string) =>
    fetchImpl(`${base}&lang=${lang}`, { headers: { Accept: 'application/json' } })
      .then((response) =>
        response.ok ? (response.json() as Promise<{ features?: PhotonFeature[] }>) : { features: [] },
      )
      .catch(() => ({ features: [] as PhotonFeature[] }))

  const [local, english] = await Promise.all([grab('default'), grab('en')])
  const enById = new Map<string, Record<string, unknown>>()
  ;(english.features || []).forEach((feature) => {
    const props = feature.properties || {}
    if (props.osm_id != null) enById.set(`${props.osm_type}/${props.osm_id}`, props)
  })

  const out: PlaceCandidate[] = []
  const seen = new Set<string>()
  ;(local.features || []).forEach((feature) => {
    if (!feature.geometry || feature.geometry.type !== 'Point' || !feature.geometry.coordinates) return
    const [lng, lat] = feature.geometry.coordinates
    const props = feature.properties || {}
    const enProps = (props.osm_id != null && enById.get(`${props.osm_type}/${props.osm_id}`)) || {}
    const countryCode = String(props.countrycode || enProps.countrycode || '').toUpperCase()
    const domestic =
      ['CN', 'HK', 'MO', 'TW'].includes(countryCode) || props.country === '中国' || props.country === 'China'
    const name =
      preferReadable(
        (props.name || props.city || props.county || props.district) as string | undefined,
        (enProps.name || enProps.city || enProps.county) as string | undefined,
      ) || query
    const region = preferReadable(
      (props.state || props.city) as string | undefined,
      (enProps.state || enProps.city) as string | undefined,
    )
    const country = preferReadable(props.country as string | undefined, enProps.country as string | undefined)
    const parts = domestic
      ? [
          region,
          preferReadable(
            (props.county || props.city || props.district) as string | undefined,
            (enProps.county || enProps.city) as string | undefined,
          ),
        ]
      : [region, country]
    // 残留看不懂的（没匹配到英文）宁可不显示
    const ctx = [...new Set(parts.filter((part) => part && part !== name && !NON_READABLE.test(part)))].join(
      ' · ',
    )
    const enName = enProps.name
    const en = /^[\x00-\x7f]+$/.test(String(enName || '')) ? String(enName).toUpperCase() : ''
    const key = `${(+lat).toFixed(3)},${(+lng).toFixed(3)}`
    if (seen.has(key)) return
    seen.add(key)
    out.push({
      name,
      lat: +(+lat).toFixed(4),
      lng: +(+lng).toFixed(4),
      domestic,
      ctx,
      country,
      cont: continentOf(countryCode),
      en,
      _rank: placeRank(props, query),
      _i: out.length,
    })
  })

  // 行政地名优先；同级保留 Photon 原始相关度顺序
  out.sort((a, b) => b._rank - a._rank || a._i - b._i)
  return out.slice(0, 8)
}

/* ——— 自定义城市坐标的持久化（key 沿用 journeyatlas_user_cities） ——— */

interface SavedCity {
  lat: number
  lng: number
  en?: string
}

function readSavedCities(): Record<string, SavedCity> {
  try {
    const raw = globalThis.localStorage?.getItem(USER_CITY_KEY)
    return raw ? (JSON.parse(raw) as Record<string, SavedCity>) : {}
  } catch {
    return {}
  }
}

/** 启动时并入此前在线检索过、已落库的自定义地点坐标。 */
export function loadUserCities(): void {
  Object.entries(readSavedCities()).forEach(([name, value]) => {
    if (!value) return
    if (typeof value.lat === 'number' && typeof value.lng === 'number' && cityLngLat(name) === null) {
      registerCity(name, value.lat, value.lng)
    }
    if (value.en) registerCity(name, value.lat, value.lng, value.en)
  })
}

/** 记住一座城：内存表 + localStorage（失败静默，隐私模式不影响使用）。 */
export function rememberCity(name: string, lat: number, lng: number, en?: string): void {
  if (!name) return
  registerCity(name, lat, lng, en)
  const saved = readSavedCities()
  saved[name] = { lat, lng, en: en || '' }
  try {
    globalThis.localStorage?.setItem(USER_CITY_KEY, JSON.stringify(saved))
  } catch {
    /* 忽略：隐私模式 */
  }
}

/** 解析地名 → 坐标并入城市表（提交时兜底用）：已收录/已选中直接用；否则在线取第一个。 */
export async function resolvePlace(name: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const clean = stripShi(String(name || '').trim())
  if (!clean) return false
  if (cityLngLat(clean)) return true
  try {
    const results = await photonSearch(clean, fetchImpl)
    if (results.length) {
      const [first] = results
      rememberCity(clean, first.lat, first.lng, first.en)
      return true
    }
  } catch {
    /* 离线/失败 → false */
  }
  return false
}
