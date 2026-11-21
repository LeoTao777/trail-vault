import type { LngLat } from './types'

/**
 * 城市坐标 / 国家 / 大洲 / 拉丁名（迁移自旧版 app.js 的 CITY、CITY_META、CITY_EN、COUNTRY_EN）。
 *
 * 这是「离线可用」的基础：内置一份常用城市坐标，Photon 在线检索到的自定义地点
 * 会通过 registerCity() 并入同一张表（旧版是直接改 CITY 常量）。
 */

export interface CityPoint {
  lat: number
  lng: number
  /** 中文/拉丁对照用：只有在线检索过的城市才有 */
  en?: string
}

export interface CityMeta {
  country: string
  continent: string
}

export const CITY: Record<string, CityPoint> = {
  北京: { lat: 39.9042, lng: 116.4074 },
  上海: { lat: 31.2304, lng: 121.4737 },
  天津: { lat: 39.3434, lng: 117.3616 },
  重庆: { lat: 29.563, lng: 106.5516 },
  杭州: { lat: 30.2741, lng: 120.1551 },
  南京: { lat: 32.0603, lng: 118.7969 },
  苏州: { lat: 31.2989, lng: 120.5853 },
  无锡: { lat: 31.4912, lng: 120.3119 },
  宁波: { lat: 29.8683, lng: 121.544 },
  合肥: { lat: 31.8206, lng: 117.2272 },
  武汉: { lat: 30.5928, lng: 114.3055 },
  长沙: { lat: 28.2282, lng: 112.9388 },
  张家界: { lat: 29.117, lng: 110.4793 },
  南昌: { lat: 28.682, lng: 115.8579 },
  广州: { lat: 23.1291, lng: 113.2644 },
  深圳: { lat: 22.5431, lng: 114.0579 },
  珠海: { lat: 22.271, lng: 113.5767 },
  东莞: { lat: 23.0207, lng: 113.7518 },
  佛山: { lat: 23.0218, lng: 113.1219 },
  桂林: { lat: 25.2736, lng: 110.29 },
  南宁: { lat: 22.817, lng: 108.3665 },
  海口: { lat: 20.044, lng: 110.1999 },
  三亚: { lat: 18.2528, lng: 109.5119 },
  厦门: { lat: 24.4798, lng: 118.0894 },
  福州: { lat: 26.0745, lng: 119.2965 },
  郑州: { lat: 34.7466, lng: 113.6254 },
  济南: { lat: 36.6512, lng: 117.1201 },
  青岛: { lat: 36.0671, lng: 120.3826 },
  石家庄: { lat: 38.0428, lng: 114.5149 },
  西安: { lat: 34.3416, lng: 108.9398 },
  成都: { lat: 30.5728, lng: 104.0668 },
  昆明: { lat: 24.8801, lng: 102.8329 },
  兰州: { lat: 36.0611, lng: 103.8343 },
  西宁: { lat: 36.6171, lng: 101.7782 },
  银川: { lat: 38.4872, lng: 106.2309 },
  呼和浩特: { lat: 40.8424, lng: 111.749 },
  乌鲁木齐: { lat: 43.8256, lng: 87.6168 },
  拉萨: { lat: 29.652, lng: 91.1721 },
  哈尔滨: { lat: 45.8038, lng: 126.535 },
  长春: { lat: 43.8171, lng: 125.3235 },
  沈阳: { lat: 41.8057, lng: 123.4315 },
  大连: { lat: 38.914, lng: 121.6147 },
  香港: { lat: 22.3193, lng: 114.1694 },
  澳门: { lat: 22.1987, lng: 113.5439 },
  巴黎: { lat: 48.8566, lng: 2.3522 },
  里昂: { lat: 45.764, lng: 4.8357 },
  马赛: { lat: 43.2965, lng: 5.3698 },
  尼斯: { lat: 43.7102, lng: 7.262 },
  威尼斯: { lat: 45.4408, lng: 12.3155 },
  米兰: { lat: 45.4642, lng: 9.19 },
  罗马: { lat: 41.9028, lng: 12.4964 },
  佛罗伦萨: { lat: 43.7696, lng: 11.2558 },
  维也纳: { lat: 48.2082, lng: 16.3738 },
  慕尼黑: { lat: 48.1351, lng: 11.582 },
  柏林: { lat: 52.52, lng: 13.405 },
  法兰克福: { lat: 50.1109, lng: 8.6821 },
  苏黎世: { lat: 47.3769, lng: 8.5417 },
  阿姆斯特丹: { lat: 52.3676, lng: 4.9041 },
  布鲁塞尔: { lat: 50.8503, lng: 4.3517 },
  巴塞罗那: { lat: 41.3874, lng: 2.1686 },
  马德里: { lat: 40.4168, lng: -3.7038 },
  伦敦: { lat: 51.5074, lng: -0.1278 },
  布拉格: { lat: 50.0755, lng: 14.4378 },
  东京: { lat: 35.6762, lng: 139.6503 },
  京都: { lat: 35.0116, lng: 135.7681 },
  大阪: { lat: 34.6937, lng: 135.5023 },
  名古屋: { lat: 35.1815, lng: 136.9066 },
  福冈: { lat: 33.5904, lng: 130.4017 },
  首尔: { lat: 37.5665, lng: 126.978 },
  曼谷: { lat: 13.7563, lng: 100.5018 },
  新加坡: { lat: 1.3521, lng: 103.8198 },
}

/** 城市 → 国家/地区 + 大洲。未列出的默认中国大陆 / 亚洲。用于「旅行档案」的国家、大洲计数。 */
export const CITY_META: Record<string, CityMeta> = {
  香港: { country: '中国香港', continent: '亚洲' },
  澳门: { country: '中国澳门', continent: '亚洲' },
  巴黎: { country: '法国', continent: '欧洲' },
  里昂: { country: '法国', continent: '欧洲' },
  马赛: { country: '法国', continent: '欧洲' },
  尼斯: { country: '法国', continent: '欧洲' },
  威尼斯: { country: '意大利', continent: '欧洲' },
  米兰: { country: '意大利', continent: '欧洲' },
  罗马: { country: '意大利', continent: '欧洲' },
  佛罗伦萨: { country: '意大利', continent: '欧洲' },
  维也纳: { country: '奥地利', continent: '欧洲' },
  慕尼黑: { country: '德国', continent: '欧洲' },
  柏林: { country: '德国', continent: '欧洲' },
  法兰克福: { country: '德国', continent: '欧洲' },
  苏黎世: { country: '瑞士', continent: '欧洲' },
  阿姆斯特丹: { country: '荷兰', continent: '欧洲' },
  布鲁塞尔: { country: '比利时', continent: '欧洲' },
  巴塞罗那: { country: '西班牙', continent: '欧洲' },
  马德里: { country: '西班牙', continent: '欧洲' },
  伦敦: { country: '英国', continent: '欧洲' },
  布拉格: { country: '捷克', continent: '欧洲' },
  东京: { country: '日本', continent: '亚洲' },
  京都: { country: '日本', continent: '亚洲' },
  大阪: { country: '日本', continent: '亚洲' },
  名古屋: { country: '日本', continent: '亚洲' },
  福冈: { country: '日本', continent: '亚洲' },
  首尔: { country: '韩国', continent: '亚洲' },
  曼谷: { country: '泰国', continent: '亚洲' },
  新加坡: { country: '新加坡', continent: '亚洲' },
}

export const DEFAULT_CITY_META: CityMeta = { country: '中国', continent: '亚洲' }

export function cityMeta(city: string | undefined): CityMeta {
  return CITY_META[String(city || '')] || DEFAULT_CITY_META
}

/** 海报落款用：城市拉丁名 + 国家英文名。没收录的回退到中文名。 */
export const CITY_EN: Record<string, string> = {
  北京: 'BEIJING',
  上海: 'SHANGHAI',
  天津: 'TIANJIN',
  重庆: 'CHONGQING',
  杭州: 'HANGZHOU',
  南京: 'NANJING',
  苏州: 'SUZHOU',
  无锡: 'WUXI',
  宁波: 'NINGBO',
  合肥: 'HEFEI',
  武汉: 'WUHAN',
  长沙: 'CHANGSHA',
  张家界: 'ZHANGJIAJIE',
  南昌: 'NANCHANG',
  广州: 'GUANGZHOU',
  深圳: 'SHENZHEN',
  珠海: 'ZHUHAI',
  东莞: 'DONGGUAN',
  佛山: 'FOSHAN',
  桂林: 'GUILIN',
  南宁: 'NANNING',
  海口: 'HAIKOU',
  三亚: 'SANYA',
  厦门: 'XIAMEN',
  福州: 'FUZHOU',
  郑州: 'ZHENGZHOU',
  济南: 'JINAN',
  青岛: 'QINGDAO',
  石家庄: 'SHIJIAZHUANG',
  西安: "XI'AN",
  成都: 'CHENGDU',
  昆明: 'KUNMING',
  兰州: 'LANZHOU',
  西宁: 'XINING',
  银川: 'YINCHUAN',
  呼和浩特: 'HOHHOT',
  乌鲁木齐: 'ÜRÜMQI',
  拉萨: 'LHASA',
  哈尔滨: 'HARBIN',
  长春: 'CHANGCHUN',
  沈阳: 'SHENYANG',
  大连: 'DALIAN',
  香港: 'HONG KONG',
  澳门: 'MACAU',
  巴黎: 'PARIS',
  里昂: 'LYON',
  马赛: 'MARSEILLE',
  尼斯: 'NICE',
  威尼斯: 'VENICE',
  米兰: 'MILAN',
  罗马: 'ROME',
  佛罗伦萨: 'FLORENCE',
  维也纳: 'VIENNA',
  慕尼黑: 'MUNICH',
  柏林: 'BERLIN',
  法兰克福: 'FRANKFURT',
  苏黎世: 'ZURICH',
  阿姆斯特丹: 'AMSTERDAM',
  布鲁塞尔: 'BRUSSELS',
  巴塞罗那: 'BARCELONA',
  马德里: 'MADRID',
  伦敦: 'LONDON',
  布拉格: 'PRAGUE',
  东京: 'TOKYO',
  京都: 'KYOTO',
  大阪: 'OSAKA',
  名古屋: 'NAGOYA',
  福冈: 'FUKUOKA',
  首尔: 'SEOUL',
  曼谷: 'BANGKOK',
  新加坡: 'SINGAPORE',
}

export const COUNTRY_EN: Record<string, string> = {
  中国: 'CHINA',
  中国香港: 'CHINA',
  中国澳门: 'CHINA',
  法国: 'FRANCE',
  意大利: 'ITALY',
  奥地利: 'AUSTRIA',
  德国: 'GERMANY',
  瑞士: 'SWITZERLAND',
  荷兰: 'NETHERLANDS',
  比利时: 'BELGIUM',
  西班牙: 'SPAIN',
  英国: 'UK',
  捷克: 'CZECHIA',
  日本: 'JAPAN',
  韩国: 'KOREA',
  泰国: 'THAILAND',
  新加坡: 'SINGAPORE',
}

export function stripShi(name: unknown): string {
  return String(name || '').replace(/市$/, '')
}

export function cityLatin(city: string | undefined): string {
  return CITY_EN[String(city || '')] || String(city || '')
}

/** 地图标签用 Title Case（"LANZHOU"→"Lanzhou"），跟底图自带地名一致；海报落款仍用全大写。 */
export function titleCase(value: string): string {
  return String(value)
    .toLowerCase()
    .replace(/(^|[\s-])([a-z])/g, (_, sep: string, char: string) => sep + char.toUpperCase())
}

export function countryLatin(city: string | undefined): string {
  return COUNTRY_EN[cityMeta(city).country] || 'CHINA'
}

/** 城市名 → [lng, lat]；未知返回 null。兼容「北京市」与「北京南站」这类写法。 */
export function cityLngLat(name: string | undefined): LngLat | null {
  if (!name) return null
  const clean = String(name).replace(/市$/, '')
  const point = CITY[clean] || CITY[clean.replace(/[南北东西站]/g, '')]
  return point ? [point.lng, point.lat] : null
}

/** 只查内置坐标（不做「去站名后缀」兜底），海报落款用。 */
export function cityPoint(name: string | undefined): CityPoint | null {
  if (!name) return null
  const clean = String(name).replace(/市$/, '')
  return CITY[clean] || CITY[clean.replace(/[南北东西站]/g, '')] || null
}

/** 并入在线检索到的自定义地点（旧版直接改 CITY 常量；这里收口成一个函数）。 */
export function registerCity(name: string, lat: number, lng: number, en?: string): void {
  if (!name) return
  CITY[name] = { lat, lng }
  if (en) CITY_EN[name] = en
}

export function hasCity(name: string | undefined): boolean {
  return cityLngLat(name) !== null
}

/** 城市排序（中文拼音序），供筛选下拉 / datalist 共用。 */
export function cityNames(): string[] {
  return Object.keys(CITY).sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

/** 车站/机场别名 → 城市名（旧版 CITY_ALIAS）。 */
export const CITY_ALIAS: Record<string, string> = {
  北京南: '北京',
  北京西: '北京',
  北京北: '北京',
  北京东: '北京',
  北京站: '北京',
  大兴机场: '北京',
  首都机场: '北京',
  上海虹桥: '上海',
  上海南: '上海',
  上海西: '上海',
  上海浦东: '上海',
  虹桥机场: '上海',
  浦东机场: '上海',
  杭州东: '杭州',
  杭州西: '杭州',
  萧山机场: '杭州',
  合肥南: '合肥',
  长沙南: '长沙',
  深圳北: '深圳',
  深圳东: '深圳',
  深圳宝安: '深圳',
  宝安机场: '深圳',
  香港西九龙: '香港',
  广州南: '广州',
  广州东: '广州',
  白云机场: '广州',
  福田: '深圳',
  南沙: '广州',
  南沙北: '广州',
  天津西: '天津',
  天津南: '天津',
  成都东: '成都',
  天府机场: '成都',
  双流机场: '成都',
}

/**
 * 城市「同一性」键：去「市」、再查车站别名。统计、断点判定、播放链都用它，
 * 保证「深圳北」与「深圳」被当成同一座城。
 */
export function cityKey(name: unknown): string {
  const clean = stripShi(String(name || '').trim())
  return CITY_ALIAS[clean] || clean
}

/* ——— 国家代码 → 大洲（Photon 候选按大洲打标） ——— */
const CONTINENT_ZH: Record<string, string> = {
  as: '亚洲',
  eu: '欧洲',
  na: '北美',
  sa: '南美',
  af: '非洲',
  oc: '大洋洲',
  other: '海外',
}

const CC_CONTINENT: Record<string, string> = {
  JP: 'as',
  KR: 'as',
  KP: 'as',
  TH: 'as',
  SG: 'as',
  MY: 'as',
  VN: 'as',
  ID: 'as',
  PH: 'as',
  IN: 'as',
  AE: 'as',
  QA: 'as',
  SA: 'as',
  IL: 'as',
  TR: 'as',
  KH: 'as',
  LA: 'as',
  MM: 'as',
  NP: 'as',
  LK: 'as',
  PK: 'as',
  BD: 'as',
  KZ: 'as',
  UZ: 'as',
  MN: 'as',
  BT: 'as',
  BN: 'as',
  IR: 'as',
  IQ: 'as',
  SY: 'as',
  YE: 'as',
  JO: 'as',
  LB: 'as',
  OM: 'as',
  KW: 'as',
  BH: 'as',
  GE: 'as',
  AM: 'as',
  AZ: 'as',
  AF: 'as',
  TM: 'as',
  KG: 'as',
  TJ: 'as',
  MV: 'as',
  FR: 'eu',
  IT: 'eu',
  DE: 'eu',
  AT: 'eu',
  CH: 'eu',
  NL: 'eu',
  BE: 'eu',
  ES: 'eu',
  GB: 'eu',
  IE: 'eu',
  PT: 'eu',
  GR: 'eu',
  CZ: 'eu',
  HU: 'eu',
  PL: 'eu',
  SE: 'eu',
  NO: 'eu',
  FI: 'eu',
  DK: 'eu',
  RU: 'eu',
  UA: 'eu',
  RO: 'eu',
  HR: 'eu',
  IS: 'eu',
  LU: 'eu',
  MC: 'eu',
  VA: 'eu',
  SK: 'eu',
  SI: 'eu',
  EE: 'eu',
  LV: 'eu',
  LT: 'eu',
  BG: 'eu',
  RS: 'eu',
  CY: 'eu',
  MT: 'eu',
  AL: 'eu',
  MK: 'eu',
  BA: 'eu',
  ME: 'eu',
  US: 'na',
  CA: 'na',
  MX: 'na',
  CU: 'na',
  CR: 'na',
  PA: 'na',
  GT: 'na',
  DO: 'na',
  JM: 'na',
  BS: 'na',
  HN: 'na',
  NI: 'na',
  SV: 'na',
  BR: 'sa',
  AR: 'sa',
  CL: 'sa',
  PE: 'sa',
  CO: 'sa',
  UY: 'sa',
  BO: 'sa',
  EC: 'sa',
  VE: 'sa',
  PY: 'sa',
  EG: 'af',
  ZA: 'af',
  MA: 'af',
  KE: 'af',
  NG: 'af',
  TZ: 'af',
  ET: 'af',
  TN: 'af',
  DZ: 'af',
  LY: 'af',
  SD: 'af',
  GH: 'af',
  CI: 'af',
  SN: 'af',
  UG: 'af',
  ZW: 'af',
  ZM: 'af',
  MZ: 'af',
  MU: 'af',
  AU: 'oc',
  NZ: 'oc',
  FJ: 'oc',
  PG: 'oc',
  PF: 'oc',
  NC: 'oc',
}

export function continentOf(countryCode: string | undefined): { key: string; zh: string } {
  const key = CC_CONTINENT[String(countryCode || '').toUpperCase()] || 'other'
  return { key, zh: CONTINENT_ZH[key] }
}
