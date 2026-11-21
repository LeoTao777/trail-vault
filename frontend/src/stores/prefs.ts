/**
 * 用户偏好（P2）：皮肤、指标可见性、展示模式、标题报头显隐、自定义标题。
 *
 * localStorage key 全部沿用旧版名字（config.ts），老用户已存的皮肤 / 标题不会丢。
 * 这里只负责「读 / 写 / 应用到 document」；真正的皮肤上色、指标条显隐、
 * 标题编辑器 UI 分别在 P3 / P6 接。
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import {
  MAP_SKIN_KEY,
  METRIC_VIS_KEY,
  SHOW_MODE_KEY,
  SITE_TITLE_OVERRIDE_KEY,
  TITLE_HIDDEN_KEY,
} from '@/config'
import {
  DEFAULT_SKIN,
  currentSiteTitle,
  documentTitle,
  isMetricVisible,
  parseFlag,
  parseMetricVisibility,
  parseSiteTitle,
  parseSkin,
  titleLines,
  type MetricVisibility,
  type SiteTitleOverride,
} from '@/domain/prefs'

import { useRecordsStore } from './records'

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function read(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    storage()?.setItem(key, value)
  } catch {
    /* 隐私模式 */
  }
}

function remove(key: string): void {
  try {
    storage()?.removeItem(key)
  } catch {
    /* 隐私模式 */
  }
}

export const usePrefsStore = defineStore('prefs', () => {
  const skin = ref<string>(DEFAULT_SKIN)
  const metricVis = ref<MetricVisibility>(parseMetricVisibility(null))
  const showMode = ref(false)
  const titleHidden = ref(false)
  const siteTitleOverride = ref<SiteTitleOverride>({})
  /** 由 router.afterEach 写入当前页名，不持久化 */
  const pageTitle = ref('')
  const ready = ref(false)

  const siteTitle = computed(() => currentSiteTitle(siteTitleOverride.value))
  const brandLines = computed(() => {
    const lines = titleLines(siteTitle.value.title)
    return lines.length ? lines : ['行旅地图']
  })
  const brandEyebrow = computed(() => siteTitle.value.eyebrow)
  const docTitle = computed(() => documentTitle(siteTitleOverride.value, pageTitle.value))

  /** 应用 DOM 层面的偏好：皮肤 data 属性、body 模式类、标签页标题。 */
  function applyDocument(): void {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    if (skin.value === DEFAULT_SKIN) root.removeAttribute('data-skin')
    else root.dataset.skin = skin.value
    document.body.classList.toggle('show-mode', showMode.value)
    document.body.classList.toggle('title-off', titleHidden.value)
    document.title = docTitle.value
  }

  /** 从 localStorage 恢复一次（AppShell onMounted 调用；SSR / 单测下静默用默认值）。 */
  function load(): void {
    if (ready.value) return
    skin.value = parseSkin(read(MAP_SKIN_KEY))
    metricVis.value = parseMetricVisibility(read(METRIC_VIS_KEY))
    showMode.value = parseFlag(read(SHOW_MODE_KEY))
    titleHidden.value = parseFlag(read(TITLE_HIDDEN_KEY))
    siteTitleOverride.value = parseSiteTitle(read(SITE_TITLE_OVERRIDE_KEY))
    ready.value = true
    applyDocument()
  }

  function setSkin(key: string): void {
    skin.value = parseSkin(key)
    write(MAP_SKIN_KEY, skin.value)
    applyDocument()
  }

  function setMetricVisible(key: string, visible: boolean): void {
    metricVis.value = { ...metricVis.value, [key]: visible }
    write(METRIC_VIS_KEY, JSON.stringify(metricVis.value))
  }

  function resetMetricVisibility(): void {
    metricVis.value = parseMetricVisibility(null)
    remove(METRIC_VIS_KEY)
  }

  function isVisible(key: string): boolean {
    return isMetricVisible(metricVis.value, key)
  }

  function setShowMode(value: boolean): void {
    showMode.value = value
    write(SHOW_MODE_KEY, value ? '1' : '0')
    // 展示模式不留「缺口·待补段」这类工作痕迹（旧版 toggleShowMode 语义）
    if (value) useRecordsStore().setFilters({ confidence: 'all' })
    applyDocument()
  }

  function toggleShowMode(): void {
    setShowMode(!showMode.value)
  }

  function setTitleHidden(value: boolean): void {
    titleHidden.value = value
    write(TITLE_HIDDEN_KEY, value ? '1' : '0')
    applyDocument()
  }

  function setSiteTitle(override: SiteTitleOverride): void {
    siteTitleOverride.value = parseSiteTitle(JSON.stringify(override))
    write(SITE_TITLE_OVERRIDE_KEY, JSON.stringify(siteTitleOverride.value))
    applyDocument()
  }

  function resetSiteTitle(): void {
    siteTitleOverride.value = {}
    remove(SITE_TITLE_OVERRIDE_KEY)
    applyDocument()
  }

  function setPageTitle(title: string): void {
    pageTitle.value = title
    applyDocument()
  }

  return {
    skin,
    metricVis,
    showMode,
    titleHidden,
    siteTitleOverride,
    pageTitle,
    ready,
    siteTitle,
    brandLines,
    brandEyebrow,
    docTitle,
    load,
    applyDocument,
    setSkin,
    setMetricVisible,
    resetMetricVisibility,
    isVisible,
    setShowMode,
    toggleShowMode,
    setTitleHidden,
    setSiteTitle,
    resetSiteTitle,
    setPageTitle,
  }
})
