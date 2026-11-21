/**
 * 偏好设置的纯解析层（P2）。
 *
 * localStorage 的 key 与旧版一字不改（见 config.ts），解析规则独立成函数便于单测：
 * 坏缓存 / 隐私模式 / 手工改坏的 JSON 一律静默回默认，绝不因为一个偏好把页面搞崩。
 */

import { DOC_TITLE_SUFFIX, SITE_TITLE } from '@/config'

export interface SiteTitleOverride {
  eyebrow?: string
  title?: string
  docTitle?: string
}

export interface SiteTitle {
  eyebrow: string
  title: string
  docTitle: string
}

export const DEFAULT_SKIN = 'warm'

/** 指标条 5 个指标；旧版 .more-checks 里 data-metric 的键。 */
export const METRIC_KEYS = ['days', 'amount', 'hours', 'cities', 'missing'] as const
export type MetricKey = (typeof METRIC_KEYS)[number]
export type MetricVisibility = Record<string, boolean>

/** 旧版写的是 '1' / '0'，顺手兼容 'true'（手工改过 localStorage 的情况）。 */
export function parseFlag(raw: string | null | undefined): boolean {
  return raw === '1' || raw === 'true'
}

/** 皮肤 key 是 maptoposter 主题 id（字母数字下划线连字符），空/脏值回暖宋纸。 */
export function parseSkin(raw: string | null | undefined): string {
  const key = String(raw ?? '').trim()
  return key && /^[\w-]{1,48}$/.test(key) ? key : DEFAULT_SKIN
}

/**
 * 指标可见性：旧版只在用户关掉某项时写 `{ key: false }`，
 * 所以缺键 = 可见。未知键原样保留，避免升级后把用户以前存过的自定义项丢掉。
 */
export function parseMetricVisibility(raw: string | null | undefined): MetricVisibility {
  const visibility: MetricVisibility = {}
  METRIC_KEYS.forEach((key) => {
    visibility[key] = true
  })
  if (!raw) return visibility

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return visibility
    Object.entries(parsed as Record<string, unknown>).forEach(([key, value]) => {
      if (typeof value === 'boolean') visibility[key] = value
    })
  } catch {
    /* 坏缓存：用全可见 */
  }
  return visibility
}

export function isMetricVisible(visibility: MetricVisibility, key: string): boolean {
  return visibility[key] !== false
}

/** 自定义标题覆盖层：只取字符串字段并限长（旧版表单 maxlength 48 / 40）。 */
export function parseSiteTitle(raw: string | null | undefined): SiteTitleOverride {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const source = parsed as Record<string, unknown>
    const override: SiteTitleOverride = {}
    if (typeof source.eyebrow === 'string') override.eyebrow = source.eyebrow.slice(0, 48)
    if (typeof source.title === 'string') override.title = source.title.slice(0, 40)
    if (typeof source.docTitle === 'string' && source.docTitle.trim()) {
      override.docTitle = source.docTitle.slice(0, 120)
    }
    return override
  } catch {
    return {}
  }
}

/** 出厂默认叠加本机覆盖层；改过主标题时，标签页标题由主标题去掉换行推导。 */
export function currentSiteTitle(override: SiteTitleOverride = {}): SiteTitle {
  const title = override.title ?? SITE_TITLE.title
  const eyebrow = override.eyebrow ?? SITE_TITLE.eyebrow
  const docTitle =
    override.docTitle ??
    (override.title !== undefined
      ? title.replace(/\s*\n\s*/g, '').trim() || SITE_TITLE.docTitle
      : SITE_TITLE.docTitle)
  return { eyebrow, title, docTitle }
}

export function titleLines(title: string): string[] {
  return String(title || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

/**
 * 标签页标题：自定义标题优先（P6 的标题编辑器写进来），否则按路由页名拼。
 * 与 router.afterEach 配合，切页和改标题都能立刻反映到标签页。
 */
export function documentTitle(override: SiteTitleOverride, pageTitle: string): string {
  if (override.docTitle) return override.docTitle
  if (override.title !== undefined) return currentSiteTitle(override).docTitle
  return pageTitle ? `${pageTitle} · ${DOC_TITLE_SUFFIX}` : `${DOC_TITLE_SUFFIX} · 行旅地图`
}
