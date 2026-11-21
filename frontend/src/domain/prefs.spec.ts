import { describe, expect, it } from 'vitest'

import { DOC_TITLE_SUFFIX, SITE_TITLE } from '@/config'

import {
  DEFAULT_SKIN,
  METRIC_KEYS,
  currentSiteTitle,
  documentTitle,
  isMetricVisible,
  parseFlag,
  parseMetricVisibility,
  parseSiteTitle,
  parseSkin,
  titleLines,
} from './prefs'

describe('parseFlag / parseSkin', () => {
  it('旧版写的是 1 / 0，顺手兼容 true', () => {
    expect(parseFlag('1')).toBe(true)
    expect(parseFlag('true')).toBe(true)
    expect(parseFlag('0')).toBe(false)
    expect(parseFlag(null)).toBe(false)
    expect(parseFlag('yes')).toBe(false)
  })

  it('皮肤 key 空 / 脏值回暖宋纸', () => {
    expect(parseSkin('slate')).toBe('slate')
    expect(parseSkin('Nordic-Frost')).toBe('Nordic-Frost')
    expect(parseSkin('')).toBe(DEFAULT_SKIN)
    expect(parseSkin(null)).toBe(DEFAULT_SKIN)
    expect(parseSkin('bad value!')).toBe(DEFAULT_SKIN)
  })
})

describe('parseMetricVisibility', () => {
  it('缺键 = 全部可见', () => {
    const visibility = parseMetricVisibility(null)
    expect(METRIC_KEYS.every((key) => visibility[key])).toBe(true)
    expect(isMetricVisible(visibility, 'days')).toBe(true)
  })

  it('只覆盖显式写的布尔项，未知键保留（不丢用户以前存过的自定义项）', () => {
    const visibility = parseMetricVisibility('{"amount":false,"custom":true}')
    expect(visibility.amount).toBe(false)
    expect(visibility.days).toBe(true)
    expect(visibility.custom).toBe(true)
    expect(isMetricVisible(visibility, 'amount')).toBe(false)
  })

  it('坏 JSON / 非对象一律回默认', () => {
    expect(parseMetricVisibility('{oops')).toEqual(parseMetricVisibility(null))
    expect(parseMetricVisibility('[]')).toEqual(parseMetricVisibility(null))
    expect(parseMetricVisibility('"text"')).toEqual(parseMetricVisibility(null))
  })
})

describe('parseSiteTitle / currentSiteTitle', () => {
  it('坏缓存回空覆盖层，出厂默认值不变', () => {
    expect(parseSiteTitle('{oops')).toEqual({})
    expect(parseSiteTitle('[]')).toEqual({})
    expect(currentSiteTitle()).toEqual({
      eyebrow: SITE_TITLE.eyebrow,
      title: SITE_TITLE.title,
      docTitle: SITE_TITLE.docTitle,
    })
  })

  it('只取字符串字段并限长', () => {
    expect(parseSiteTitle('{"title":123,"eyebrow":"X","docTitle":"  "}')).toEqual({ eyebrow: 'X' })
    expect(parseSiteTitle(`{"title":"${'x'.repeat(90)}"}`).title).toHaveLength(40)
  })

  it('改过主标题时，标签页标题由主标题去掉换行推导', () => {
    const merged = currentSiteTitle({ eyebrow: 'MY ATLAS', title: '我的\n旅行地图' })
    expect(merged.eyebrow).toBe('MY ATLAS')
    expect(merged.title).toBe('我的\n旅行地图')
    expect(merged.docTitle).toBe('我的旅行地图')
    expect(titleLines(merged.title)).toEqual(['我的', '旅行地图'])
  })

  it('显式 docTitle 优先', () => {
    expect(currentSiteTitle({ title: 'A\nB', docTitle: '自定义标签' }).docTitle).toBe('自定义标签')
  })
})

describe('documentTitle', () => {
  it('没有自定义标题时按路由页名拼', () => {
    expect(documentTitle({}, '地图 · 时间线')).toBe(`地图 · 时间线 · ${DOC_TITLE_SUFFIX}`)
    expect(documentTitle({}, '')).toBe(`${DOC_TITLE_SUFFIX} · 行旅地图`)
  })

  it('自定义标题优先于页名', () => {
    expect(documentTitle({ title: '我的\n旅行地图' }, '录入')).toBe('我的旅行地图')
    expect(documentTitle({ docTitle: '自定义' }, '录入')).toBe('自定义')
  })
})
