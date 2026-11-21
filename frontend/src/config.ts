/**
 * 站点级常量（迁移自旧版 app.js 顶部配置区）。
 *
 * 开源定制只改这里就能换成自己的站点：项目名、报头、站点主人、常居城市。
 * localStorage 的 key 一个都不能改 —— 改了用户已保存的皮肤 / 自定义城市 / 标题就全丢。
 */

export const APP_NAME = 'Roamap'

/** 没有自定义标题时，标签页按「<页名> · TrailVault」拼接（P0 router.afterEach 里的常量）。 */
export const DOC_TITLE_SUFFIX = 'TrailVault'

export const SITE_TITLE = {
  eyebrow: 'ROAMAP',
  title: 'LeoTao\n行旅地图',
  docTitle: 'Leotao · 行旅地图',
} as const

/** 站点主人 / 默认旅客名 —— 开源后改成你自己的；示例为虚构人物「Nova Kepler」。 */
export const OWNER_NAME = 'Nova Kepler'

/** 常居城市 —— 用于「在家夜数」的互补推算；改成你自己的主城。 */
export const HOME_CITY = '上海'

/* ——— localStorage key（沿用旧版，切勿改名） ——— */
export const RECORDS_STORAGE_KEY = 'journeyatlas_records_v1'
export const USER_CITY_KEY = 'journeyatlas_user_cities'
export const USER_RAIL_KEY = 'journeyatlas_user_rail'
export const MAP_SKIN_KEY = 'journeyatlas_map_skin'
export const METRIC_VIS_KEY = 'journeyatlas-metric-vis'
export const SHOW_MODE_KEY = 'yw-show-mode'
export const TITLE_HIDDEN_KEY = 'yw-title-hidden'
export const SITE_TITLE_OVERRIDE_KEY = 'yw-site-title'

/* ——— 后端接口 ——— */
export const API_RECORDS_URL = '/api/records'
export const API_USERS_URL = '/api/users'

/* ——— 运行时静态资源（public/data，走到 /data/* 由后端直发） ——— */
export const CHINA_MAP_URL = '/data/china-100000-full.json'
export const WORLD_MAP_URL = '/data/world-110m.json'
export const WATER_CHINA_URL = '/data/water-china.json'
export const RAIL_PATHS_URL = '/data/rail-paths.json'

export interface MapBounds {
  minLng: number
  maxLng: number
  minLat: number
  maxLat: number
}

export const CHINA_BOUNDS: MapBounds = {
  minLng: 73.4,
  maxLng: 135.2,
  minLat: 17.3,
  maxLat: 53.7,
}

/** 世界视图用的经纬度范围（等距矩形）。覆盖中国 + 主要海外区域；裁掉南极。 */
export const WORLD_BOUNDS: MapBounds = {
  minLng: -180,
  maxLng: 180,
  minLat: -60,
  maxLat: 85,
}

export type MapViewScope = 'china' | 'world'
