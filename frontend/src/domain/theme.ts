/**
 * 海报 / 地图配色（迁移自旧版 app.js 的 POSTER_THEMES、POSTER_PALETTES、applyMapTheme 辅助函数）。
 *
 * 数据来源：旧版把 20 套 maptoposter 主题放在 data/*.js 里挂到 window.POSTER_THEMES。
 * 这里不再依赖全局：P6 把主题表搬成 `src/data/posterThemes.ts` 后调用 registerPosterThemes() 即可；
 * 迁移期如果页面上仍有 window.POSTER_THEMES（旧脚本还在），模块加载时会自动并入，数字/套数与旧版一致。
 */

export interface PosterThemeColors {
  bg: string
  text: string
  water: string
  gradient_color?: string
  poi_color?: string
  parks?: string
  road_motorway?: string
  road_primary?: string
  road_secondary?: string
  road_tertiary?: string
  road_residential?: string
  road_default?: string
}

export interface PosterTheme {
  id: string
  name?: string
  colors: PosterThemeColors
}

export interface PosterPalette {
  /** 下拉里显示的中文名（四字，整齐不超宽） */
  label: string
  night: boolean
  paper: string
  ink: string
  inkSoft: string
  red: string
  land: string
  border: string
  prov: string
  water: string
  road: string
}

/** maptoposter 主题的统一中文名（四字），下拉里更整齐、不超宽。 */
export const POSTER_THEME_CN: Record<string, string> = {
  'Nordic-Frost': '北欧霜白',
  'Desert-Rose': '沙漠玫瑰',
  'Cyberpunk-Neon': '赛博霓虹',
  'Sulfur-Slate': '硫磺岩灰',
  'Vintage-Nautical': '复古航海',
  'Lavender-Mist': '薰衣草雾',
  'Carbon-Fiber': '碳纤暗黑',
  'Mediterranean-Summer': '地中海夏',
  'Royal-Velvet': '皇家丝绒',
  'Forest-Moss': '森林苔藓',
  'Cotton-Candy': '棉花糖粉',
  'Brutalist-Concrete': '清水混凝',
  'Solarized-Dark': '日光暗调',
  'Matcha-Latte': '抹茶拿铁',
  'Red-Alert': '赤红警戒',
  'Gilded-Noir': '鎏金暗夜',
  'Ocean-Abyss': '深海渊蓝',
  'Sakura-Branch': '樱枝粉白',
  'Terra-Clay': '赤陶黏土',
  'Glitch-Purple': '故障紫调',
}

/** 与地图皮肤同名的 3 套基础配色（暖宋纸 / 板岩灰 / 深海夜蓝）。 */
const BASE_PALETTES: Record<string, PosterPalette> = {
  warm: {
    label: '暖宋纸',
    paper: '#fbfaf4',
    ink: '#2b2823',
    inkSoft: '#5b554c',
    red: '#b84232',
    land: '#f1ece1',
    border: '#d8d0c0',
    prov: '#e3ddce',
    water: '#bcccd0',
    road: '#c4b79f',
    night: false,
  },
  slate: {
    label: '板岩灰',
    paper: '#f4f5f6',
    ink: '#2a2d30',
    inkSoft: '#5c6166',
    red: '#b84232',
    land: '#e9ebed',
    border: '#d3d7da',
    prov: '#dee1e4',
    water: '#cfd6db',
    road: '#bfc4c9',
    night: false,
  },
  night: {
    label: '深海夜蓝',
    paper: '#0c1a30',
    ink: '#eef4ff',
    inkSoft: '#9fb6d6',
    red: '#ff6a5a',
    land: '#13273f',
    border: '#2c4259',
    prov: '#203850',
    water: '#0f2236',
    road: '#3a4f6a',
    night: true,
  },
}

/** 深色判断：加权亮度 < 112 视为深色主题。 */
export function posterIsDark(hex: string | undefined): boolean {
  const matched = /^#?([0-9a-fA-F]{6})$/.exec(String(hex || ''))
  if (!matched) return false
  const value = parseInt(matched[1], 16)
  return 0.299 * ((value >> 16) & 255) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255) < 112
}

/** maptoposter 主题 → 海报/地图可用的调色板。 */
export function posterPaletteFromTheme(theme: PosterTheme): PosterPalette {
  const colors = theme.colors || ({ bg: '#fbfaf4', text: '#2b2823', water: '#bcccd0' } as PosterThemeColors)
  const dark = posterIsDark(colors.bg)
  return {
    label: POSTER_THEME_CN[theme.id] || theme.name || theme.id,
    night: dark,
    paper: colors.bg,
    ink: colors.text,
    inkSoft: colors.road_secondary || colors.road_primary || colors.text,
    red: colors.poi_color || (dark ? '#ff6a5a' : '#b84232'),
    land: colors.parks || colors.bg,
    border: colors.road_tertiary || colors.road_default || colors.text,
    prov: colors.road_residential || colors.road_default || colors.water,
    water: colors.water,
    road: colors.road_motorway || colors.road_primary || colors.road_default || colors.text,
  }
}

/** 全部配色（基础 3 套 + 已注册的主题）。P4/P6 的色板下拉直接遍历它。 */
export const POSTER_PALETTES: Record<string, PosterPalette> = { ...BASE_PALETTES }

/** 把主题表并入配色表（可重复调用：以最后一次注册的主题为准）。 */
export function registerPosterThemes(themes: readonly PosterTheme[]): void {
  themes.forEach((theme) => {
    if (theme?.id && theme.colors) POSTER_PALETTES[theme.id] = posterPaletteFromTheme(theme)
  })
}

/* ——— 颜色小工具（地图主题重上色 / 海报共用） ——— */

export function hexToRgb(hex: string | undefined): [number, number, number] {
  let value = String(hex || '').replace('#', '')
  if (value.length === 3)
    value = value
      .split('')
      .map((char) => char + char)
      .join('')
  const number = parseInt(value || '0', 16)
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255]
}

export function rgbToHex(r: number, g: number, b: number): string {
  const part = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}`
}

/**
 * hex 亮度抬升（保色相/饱和）：深色主题在国家级缩放下都黑成一团彼此难分，
 * 给底/水/地被抬一点亮度让色相看得出。
 */
export function liftLightness(hex: string | undefined, addL = 0, minL = 0): string {
  let [r, g, b] = hexToRgb(hex)
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let hue = 0
  let sat = 0
  let light = (max + min) / 2
  if (max !== min) {
    const delta = max - min
    sat = light > 0.5 ? delta / (2 - max - min) : delta / (max + min)
    if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0)
    else if (max === g) hue = (b - r) / delta + 2
    else hue = (r - g) / delta + 4
    hue /= 6
  }
  light = Math.min(1, Math.max(minL, light + addL))

  const toRgb = (p: number, q: number, t: number) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }

  let outR: number
  let outG: number
  let outB: number
  if (sat === 0) {
    outR = outG = outB = light
  } else {
    const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat
    const p = 2 * light - q
    outR = toRgb(p, q, hue + 1 / 3)
    outG = toRgb(p, q, hue)
    outB = toRgb(p, q, hue - 1 / 3)
  }
  return rgbToHex(outR * 255, outG * 255, outB * 255)
}

/** 「#rrggbb」+ alpha → `rgba()`。 */
export function hexA(hex: string | undefined, alpha: number): string {
  const value = String(hex || '').replace('#', '')
  if (value.length < 6) return `rgba(0,0,0,${alpha})`
  const number = parseInt(value.slice(0, 6), 16)
  return `rgba(${(number >> 16) & 255},${(number >> 8) & 255},${number & 255},${alpha})`
}

/* 迁移期兼容：旧版把主题挂在 window.POSTER_THEMES 上（data/*.js） */
const globalThemes = (globalThis as unknown as { POSTER_THEMES?: PosterTheme[] }).POSTER_THEMES
if (Array.isArray(globalThemes)) registerPosterThemes(globalThemes)
