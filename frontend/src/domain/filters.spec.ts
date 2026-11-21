import { describe, expect, it } from 'vitest'

import { OWNER_NAME } from '@/config'
import { records } from '@/test/records'

import {
  DEFAULT_FILTERS,
  buildSuggestions,
  describeScope,
  filterOptions,
  filterRecords,
  filteredRecords,
  includesTraveler,
  routeKey,
  usernameOf,
  type Filters,
} from './filters'

const sample = () =>
  records(
    {
      startDate: '2023-05-01',
      origin: '上海',
      destination: '杭州',
      transportNo: 'G7501',
      confidence: 'confirmed',
      traveler: OWNER_NAME,
    },
    {
      startDate: '2024-06-01',
      kind: 'flight',
      origin: '巴黎',
      destination: '上海',
      transportNo: 'MU553',
      confidence: 'partial',
      traveler: '林叙',
      people: ['林叙'],
    },
    {
      startDate: '2024-07-01',
      origin: '上海',
      destination: '北京',
      transportNo: 'CA1883',
      confidence: 'pending',
      people: [OWNER_NAME, '林叙'],
    },
    {
      startDate: '2024-08-01',
      kind: 'cancelled',
      origin: '北京',
      destination: '上海',
      confidence: 'confirmed',
      countsAsAway: false,
      countsAsVisited: false,
    },
  )

const filters = (patch: Partial<Filters> = {}): Filters => ({ ...DEFAULT_FILTERS, ...patch })

describe('includesTraveler', () => {
  const list = sample()

  it('all 不筛、self 命中站点主人（traveler 或 people）', () => {
    expect(includesTraveler(list[0], 'all')).toBe(true)
    expect(includesTraveler(list[0], 'self')).toBe(true)
    expect(includesTraveler(list[1], 'self')).toBe(false)
    // people 里有主人也算
    expect(includesTraveler(list[2], 'self')).toBe(true)
  })

  it('按名字包含匹配（兼容「Nova Kepler (本人)」这类写法）', () => {
    expect(includesTraveler(list[1], '林叙')).toBe(true)
    expect(includesTraveler(list[2], '林叙')).toBe(true)
    expect(includesTraveler(list[0], '林叙')).toBe(false)
  })
})

describe('filters / filterRecords / filteredRecords', () => {
  const list = sample()

  it('默认筛选：全部年份 · 自己 · 全部类型 · 全部证据', () => {
    expect(DEFAULT_FILTERS).toEqual({ year: 'all', traveler: 'self', kind: 'all', confidence: 'all' })
    expect(filterRecords(list, filters()).map((record) => record.startDate)).toEqual([
      '2023-05-01',
      '2024-07-01',
    ])
  })

  it('年份 / 类型 / 证据 / 旅客可叠加', () => {
    expect(filterRecords(list, filters({ year: '2024', traveler: 'all' }))).toHaveLength(3)
    expect(filterRecords(list, filters({ year: '2024', kind: 'flight', traveler: 'all' }))).toHaveLength(1)
    expect(filterRecords(list, filters({ confidence: 'partial', traveler: 'all' }))).toHaveLength(1)
    expect(filterRecords(list, filters({ traveler: '林叙' }))).toHaveLength(2)
    expect(filterRecords(list, filters({ traveler: 'all' }))).toHaveLength(4)
  })

  it('退改记录仍在数据里，但不会出现在类型筛选选项里', () => {
    expect(filterRecords(list, filters({ kind: 'cancelled', traveler: 'all' }))).toHaveLength(1)
    const options = filterOptions(list)
    expect(options.kinds.map((option) => option.key)).not.toContain('cancelled')
    expect(options.kinds.map((option) => option.key)).toEqual(['flight', 'rail', 'road', 'stay', 'other'])
  })

  it('只有筛「待补证据」时才注入断点占位（其它视图保持干净）', () => {
    const clean = filteredRecords(list, filters())
    expect(clean.some((record) => record._gap)).toBe(false)

    const pending = filteredRecords(list, filters({ confidence: 'pending', traveler: 'all' }))
    // 杭州 → 巴黎 之间缺一段连接
    const gaps = pending.filter((record) => record._gap)
    expect(gaps).toHaveLength(1)
    expect(gaps[0].title).toBe('杭州 → 巴黎')
    expect(pending.some((record) => record.confidence === 'pending' && !record._gap)).toBe(true)
  })
})

describe('filterOptions', () => {
  it('年份升序、旅客来自数据与后端用户且排除站点主人、证据含全部键', () => {
    const options = filterOptions(sample(), ['lin'])
    expect(options.years).toEqual(['2023', '2024'])
    expect(options.travelers).not.toContain(OWNER_NAME)
    expect(options.travelers).toContain('林叙')
    expect(options.travelers).toContain('lin')
    expect(options.confidences.map((option) => option.key)).toEqual([
      'confirmed',
      'partial',
      'inferred',
      'pending',
    ])
    expect(options.cities).toContain('上海')
    expect(options.cities.length).toBeGreaterThan(50)
  })
})

describe('describeScope 口径标签', () => {
  it('反映完整的四项筛选', () => {
    expect(describeScope(DEFAULT_FILTERS)).toBe(`全部年份 · ${OWNER_NAME}`)
    expect(describeScope({ year: '2024', traveler: 'self', kind: 'rail', confidence: 'partial' })).toBe(
      `2024 年 · ${OWNER_NAME} · 铁路 · 部分确认`,
    )
    expect(describeScope({ year: 'all', traveler: 'all', kind: 'all', confidence: 'all' })).toBe(
      '全部年份 · 全部旅客',
    )
  })
})

describe('buildSuggestions 搜索联想', () => {
  const list = sample()

  it('车次/航班号前缀优先', () => {
    expect(buildSuggestions(list, 'g75').map((record) => record.transportNo)).toEqual(['G7501'])
    expect(buildSuggestions(list, 'mu').map((record) => record.transportNo)).toEqual(['MU553'])
  })

  it('城市名命中（起讫均可），空查询不返回候选', () => {
    const hits = buildSuggestions(list, '北京').map((record) => record.startDate)
    expect(hits).toEqual(expect.arrayContaining(['2024-07-01', '2024-08-01']))
    expect(buildSuggestions(list, '   ')).toEqual([])
    expect(buildSuggestions(list, '不存在的关键词')).toEqual([])
  })

  it('最多返回 8 条', () => {
    const many = records(
      ...Array.from({ length: 20 }, (_, index) => ({
        startDate: `2024-01-${String((index % 28) + 1).padStart(2, '0')}`,
        origin: '上海',
        destination: '杭州',
      })),
    )
    expect(buildSuggestions(many, '上海')).toHaveLength(8)
  })
})

describe('routeKey 双向合并', () => {
  it('A⇌B 与 B⇌A 是同一个键，只去「市」不查站名别名', () => {
    expect(routeKey('上海', '杭州')).toBe(routeKey('杭州', '上海'))
    expect(routeKey('上海市', '杭州')).toBe(routeKey('杭州', '上海'))
    expect(routeKey('上海虹桥', '杭州')).toContain('上海虹桥')
  })
})

describe('usernameOf', () => {
  it('向后端 User 的 username / name / email 兜底，兼容纯字符串数组', () => {
    expect(usernameOf({ username: 'nova', name: 'N', email: 'e@x' })).toBe('nova')
    expect(usernameOf({ name: 'N', email: 'e@x' })).toBe('N')
    expect(usernameOf({ email: 'e@x' })).toBe('e@x')
    expect(usernameOf('  lin  ')).toBe('lin')
    expect(usernameOf({})).toBe('')
  })
})
