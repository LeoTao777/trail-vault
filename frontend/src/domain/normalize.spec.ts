import { describe, expect, it } from 'vitest'

import { normalize, parseOptionalNumber } from './normalize'

describe('parseOptionalNumber', () => {
  it('空值不假装成 0', () => {
    expect(parseOptionalNumber('')).toBeNull()
    expect(parseOptionalNumber(null)).toBeNull()
    expect(parseOptionalNumber(undefined)).toBeNull()
  })

  it('数字与数字字符串都转成数字，脏值转 null', () => {
    expect(parseOptionalNumber('12.5')).toBe(12.5)
    expect(parseOptionalNumber(0)).toBe(0)
    expect(parseOptionalNumber('abc')).toBeNull()
    expect(parseOptionalNumber(Number.NaN)).toBeNull()
  })
})

describe('normalize 的脏数据兜底（旧版行为，改动前先看这里）', () => {
  it('"false" 字符串认作 false', () => {
    const [record] = normalize([
      {
        startDate: '2024-01-01',
        countsAsAway: 'false',
        countsAsVisited: 'false',
        showInTimeline: 'false',
      },
    ])
    expect(record.countsAsAway).toBe(false)
    expect(record.countsAsVisited).toBe(false)
    expect(record.showInTimeline).toBe(false)
  })

  it('缺省时布尔为 true（只有明确 false / "false" 才是 false）', () => {
    const [record] = normalize([{ startDate: '2024-01-01' }])
    expect(record.countsAsAway).toBe(true)
    expect(record.countsAsVisited).toBe(true)
    expect(record.showInTimeline).toBe(true)
  })

  it('people 支持「、,，/」四种分隔，并兜底 traveler', () => {
    const [record] = normalize([{ startDate: '2024-01-01', people: '甲、乙/丙,丁' }])
    expect(record.people).toEqual(['甲', '乙', '丙', '丁'])
    expect(record.traveler).toBe('甲 / 乙 / 丙 / 丁')
  })

  it('people 是数组时原样保留；没 people 时用 traveler 兜底', () => {
    const [withArray] = normalize([{ startDate: '2024-01-01', people: ['甲', '乙'] }])
    expect(withArray.people).toEqual(['甲', '乙'])

    const [withTraveler] = normalize([{ startDate: '2024-01-01', traveler: '丙' }])
    expect(withTraveler.people).toEqual(['丙'])
  })

  it('非法 kind → other；退改(cancelled) 保留原值', () => {
    const list = normalize([
      { startDate: '2024-01-01', kind: 'teleport' },
      { startDate: '2024-01-02', kind: 'cancelled' },
    ])
    expect(list[0].kind).toBe('other')
    expect(list[1].kind).toBe('cancelled')
  })

  it('缺 id / endDate / title / confidence / displayLayer 的兜底', () => {
    const [record] = normalize([{ startDate: '2024-05-01', origin: '上海', destination: '杭州' }])
    expect(record.id).toBe('2024-05-01-0')
    expect(record.endDate).toBe('2024-05-01')
    expect(record.title).toBe('上海 → 杭州')
    expect(record.confidence).toBe('pending')
    expect(record.displayLayer).toBe('journey')
  })

  it('无起讫城市的标题兜底为「未命名行程」', () => {
    const [record] = normalize([{ startDate: '2024-05-01' }])
    expect(record.title).toBe('未命名行程')
  })

  it('金额/发票额/时长转数字或 null', () => {
    const [record] = normalize([
      { startDate: '2024-05-01', amountCny: '128.50', invoiceAmountCny: '', durationMinutes: '90' },
    ])
    expect(record.amountCny).toBe(128.5)
    expect(record.invoiceAmountCny).toBeNull()
    expect(record.durationMinutes).toBe(90)
  })

  it('按 startDate 升序排序，但 id 兜底用的是原始数组下标', () => {
    const list = normalize([{ startDate: '2024-03-01' }, { startDate: '2024-01-01' }])
    expect(list.map((record) => record.startDate)).toEqual(['2024-01-01', '2024-03-01'])
    expect(list[0].id).toBe('2024-01-01-1')
    expect(list[1].id).toBe('2024-03-01-0')
  })

  it('归一化是幂等的（第二次 normalize 不改任何数值）', () => {
    const once = normalize([
      { startDate: '2024-01-01', kind: 'rail', amountCny: '10', durationMinutes: '60', people: '甲、乙' },
    ])
    const twice = normalize(once as unknown as Record<string, unknown>[])
    expect(twice).toEqual(once)
  })

  it('不认识的字段原样透传（POST 回后端的 payload 与旧版一致）', () => {
    const [record] = normalize([{ startDate: '2024-01-01', customField: 'keep-me' }])
    expect((record as unknown as Record<string, unknown>).customField).toBe('keep-me')
  })
})
