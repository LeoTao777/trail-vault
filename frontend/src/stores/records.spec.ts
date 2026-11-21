import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { OWNER_NAME } from '@/config'
import { DEFAULT_FILTERS } from '@/domain/filters'
import { records as makeRecords } from '@/test/records'

import { useRecordsStore } from './records'

beforeEach(() => setActivePinia(createPinia()))

const list = () =>
  makeRecords(
    {
      id: 'a',
      startDate: '2023-05-01',
      origin: '上海',
      destination: '杭州',
      traveler: OWNER_NAME,
      people: [OWNER_NAME],
    },
    {
      id: 'b',
      startDate: '2024-06-01',
      kind: 'flight',
      origin: '巴黎',
      destination: '上海',
      traveler: '林叙',
      people: ['林叙'],
      confidence: 'partial',
    },
    {
      id: 'c',
      startDate: '2024-07-01',
      origin: '上海',
      destination: '北京',
      traveler: OWNER_NAME,
      people: [OWNER_NAME],
    },
  )

describe('useRecordsStore · 筛选与选中态', () => {
  it('默认筛选 = 站点主人；重置筛选后口径回到全部年份', () => {
    const store = useRecordsStore()
    store.records = list()
    expect(store.filteredRecords.map((record) => record.id)).toEqual(['a', 'c'])
    expect(store.ledgerRecords.map((record) => record.id)).toEqual(['a', 'c'])

    store.setFilters({ year: '2024' })
    expect(store.filteredRecords.map((record) => record.id)).toEqual(['c'])
    expect(store.scopeLabel).toContain('2024')

    store.resetFilters()
    expect(store.filters).toEqual(DEFAULT_FILTERS)
    expect(store.filteredRecords.map((record) => record.id)).toEqual(['a', 'c'])
  })

  it('年份 / 旅客叠加筛选，selectedId 自动落到仍可见的第一段', () => {
    const store = useRecordsStore()
    store.records = list()
    store.select('a')
    expect(store.focusId).toBe('a')

    store.setFilters({ year: '2024' })
    expect(store.selectedId).toBe('c')
    expect(store.selectedRecord?.id).toBe('c')

    store.setFilters({ traveler: 'all' })
    expect(store.filteredRecords.map((record) => record.id)).toEqual(['b', 'c'])
  })

  it('写入的筛选值统一经过 sanitizeFilters（脏值不会把页面筛空）', () => {
    const store = useRecordsStore()
    store.records = list()
    store.setFilters({ year: '24', kind: 'spaceship', traveler: 'all', confidence: 'partial' })
    expect(store.filters).toEqual({
      year: 'all',
      traveler: 'all',
      kind: 'all',
      confidence: 'partial',
    })
  })

  it('focus 深链：段存在但被筛掉时清筛选并定位；clearFocus 保留选中', () => {
    const store = useRecordsStore()
    store.records = list()
    store.setFilters({ year: '2024' })
    store.setFocusId('a')
    expect(store.filters).toEqual(DEFAULT_FILTERS)
    expect(store.selectedId).toBe('a')
    expect(store.focusId).toBe('a')

    store.clearFocus()
    expect(store.focusId).toBeNull()
    expect(store.selectedId).toBe('a')

    // 不存在的 id 不造一条假选中
    store.setFocusId('missing-id')
    expect(store.selectedId).toBe('a')
  })

  it('pending 证据才注入动态缺口，且指标与 domain 同源', () => {
    const store = useRecordsStore()
    store.records = list()
    store.setFilters({ traveler: 'all' })
    expect(store.filteredRecords.some((record) => record._gap)).toBe(false)
    expect(store.metrics.cities.length).toBeGreaterThan(0)

    store.setFilters({ confidence: 'pending' })
    expect(store.filteredRecords.some((record) => record._gap)).toBe(true)
    expect(store.ledgerRecords.some((record) => record._gap)).toBe(false)
  })
})
