import { describe, expect, it } from 'vitest'

import { DEFAULT_FILTERS } from './filters'
import {
  FILTER_QUERY_KEYS,
  buildFilterQuery,
  hasFilterQuery,
  parseFilters,
  parseFocusId,
  sameFilters,
  sameQuery,
  sanitizeFilters,
} from './query'

describe('parseFilters / sanitizeFilters', () => {
  it('空 query 与无关参数都回默认口径', () => {
    expect(parseFilters({})).toEqual(DEFAULT_FILTERS)
    expect(parseFilters({ foo: 'bar' })).toEqual(DEFAULT_FILTERS)
    expect(sanitizeFilters(null)).toEqual(DEFAULT_FILTERS)
  })

  it('四个键可叠加，重复参数取第一个', () => {
    expect(parseFilters({ year: '2024', traveler: '林叙', kind: 'rail', confidence: 'partial' })).toEqual({
      year: '2024',
      traveler: '林叙',
      kind: 'rail',
      confidence: 'partial',
    })
    expect(parseFilters({ year: ['2023', '2024'], kind: 'flight' })).toEqual({
      ...DEFAULT_FILTERS,
      year: '2023',
      kind: 'flight',
    })
  })

  it('脏值逐项回默认，不让坏链接把页面筛空', () => {
    expect(parseFilters({ year: '24', kind: 'spaceship', confidence: 'unknown', traveler: '' })).toEqual(
      DEFAULT_FILTERS,
    )
    expect(parseFilters({ year: 'all', traveler: 'all', kind: 'all', confidence: 'all' })).toEqual(
      DEFAULT_FILTERS,
    )
  })

  it('cancelled 允许出现在深链里（数据里仍有该 kind，只是下拉不列）', () => {
    expect(parseFilters({ kind: 'cancelled' }).kind).toBe('cancelled')
  })

  it('旅客是自由文本但限制长度、去掉首尾空白', () => {
    expect(parseFilters({ traveler: '  林叙  ' }).traveler).toBe('林叙')
    expect(parseFilters({ traveler: 'x'.repeat(200) })).toEqual(DEFAULT_FILTERS)
  })

  it('sameFilters 逐键比较', () => {
    expect(sameFilters(DEFAULT_FILTERS, { ...DEFAULT_FILTERS })).toBe(true)
    expect(sameFilters(DEFAULT_FILTERS, { ...DEFAULT_FILTERS, year: '2024' })).toBe(false)
  })
})

describe('hasFilterQuery', () => {
  it('只有显式带筛选键时才让 URL 说了算', () => {
    expect(FILTER_QUERY_KEYS).toEqual(['year', 'traveler', 'kind', 'confidence'])
    expect(hasFilterQuery({})).toBe(false)
    expect(hasFilterQuery({ foo: 'bar' })).toBe(false)
    expect(hasFilterQuery({ year: undefined })).toBe(false)
    expect(hasFilterQuery({ year: '' })).toBe(true)
    expect(hasFilterQuery({ traveler: 'self' })).toBe(true)
  })
})

describe('buildFilterQuery', () => {
  it('默认口径不写参数，链接保持干净', () => {
    expect(buildFilterQuery(DEFAULT_FILTERS, {})).toEqual({})
  })

  it('非默认才写；重建时先清掉旧的四个筛选键与 focus', () => {
    const filters = { ...DEFAULT_FILTERS, year: '2024', kind: 'rail' }
    expect(
      buildFilterQuery(filters, {
        year: '2023',
        confidence: 'pending',
        foo: 'bar',
        focus: 'x-1',
      }),
    ).toEqual({ foo: 'bar', year: '2024', kind: 'rail' })
  })

  it('focus 只在传入时写，其它参数原样保留', () => {
    expect(buildFilterQuery(DEFAULT_FILTERS, { utm: 'a' }, 'rec-1')).toEqual({ utm: 'a', focus: 'rec-1' })
    expect(buildFilterQuery(DEFAULT_FILTERS, { focus: 'old' }, null)).toEqual({})
  })

  it('同一组筛选重复构建结果稳定（挡住 router.replace 回环）', () => {
    const filters = { ...DEFAULT_FILTERS, year: '2024' }
    const once = buildFilterQuery(filters, {})
    expect(sameQuery(buildFilterQuery(filters, once), once)).toBe(true)
  })
})

describe('parseFocusId / sameQuery', () => {
  it('focus 取第一个值并限长', () => {
    expect(parseFocusId({ focus: 'rec-1' })).toBe('rec-1')
    expect(parseFocusId({ focus: ['a', 'b'] })).toBe('a')
    expect(parseFocusId({ focus: '   ' })).toBeNull()
    expect(parseFocusId({})).toBeNull()
    expect(parseFocusId({ focus: 'x'.repeat(300) })).toBeNull()
  })

  it('sameQuery 把缺键 / undefined / 单值数组视作等价', () => {
    expect(sameQuery({ foo: undefined }, {})).toBe(true)
    expect(sameQuery({ year: '2024' }, { year: ['2024'] })).toBe(true)
    expect(sameQuery({ year: '2024' }, { year: '2023' })).toBe(false)
    expect(sameQuery({ a: ['1', '2'] }, { a: ['1', '3'] })).toBe(false)
  })
})
