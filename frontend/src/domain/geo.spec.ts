import { describe, expect, it } from 'vitest'

import { CHINA_BOUNDS, WORLD_BOUNDS } from '@/config'
import { records } from '@/test/records'

import { cityLngLat, cityKey, stripShi, titleCase } from './city'
import { dataBounds, fitToRecords, geoArc, greatCircleKm, inChinaBounds, mercatorXY } from './geo'

describe('greatCircleKm', () => {
  it('上海 → 北京约 1067 公里（历史里程口径）', () => {
    const km = greatCircleKm('上海', '北京')
    expect(km).toBeGreaterThan(1040)
    expect(km).toBeLessThan(1090)
  })

  it('对称、同城为 0、未知城市为 0（不猜坐标）', () => {
    expect(greatCircleKm('上海', '杭州')).toBe(greatCircleKm('杭州', '上海'))
    expect(greatCircleKm('上海', '上海')).toBe(0)
    expect(greatCircleKm('上海', '不存在的城')).toBe(0)
    expect(greatCircleKm(undefined, '上海')).toBe(0)
  })

  it('只认内置 CITY 表（带「市」/站名不做兜底，保证历史数字不变）', () => {
    expect(greatCircleKm('上海市', '杭州')).toBe(0)
    expect(greatCircleKm('上海虹桥', '杭州')).toBe(0)
    expect(cityLngLat('上海')).toEqual([121.4737, 31.2304])
    expect(cityLngLat('北京')).toEqual([116.4074, 39.9042])
    expect(cityLngLat('上海市')).toEqual([121.4737, 31.2304])
    expect(cityLngLat('上海虹桥')).toBeNull()
  })
})

describe('geoArc 大圆弧', () => {
  const a: [number, number] = [121.4737, 31.2304]
  const b: [number, number] = [2.3522, 48.8566]

  it('默认插 48 段 → 49 个点，首尾落在两端城市', () => {
    const arc = geoArc(a, b)
    expect(arc).toHaveLength(49)
    expect(arc[0][0]).toBeCloseTo(a[0], 6)
    expect(arc[0][1]).toBeCloseTo(a[1], 6)
    expect(arc[48][0]).toBeCloseTo(b[0], 6)
    expect(arc[48][1]).toBeCloseTo(b[1], 6)
  })

  it('两点重合时退回直线（不产生 NaN）', () => {
    expect(geoArc(a, a)).toEqual([a, a])
  })
})

describe('mercatorXY', () => {
  it('原点在画面正中，纬度越大 y 越小', () => {
    expect(mercatorXY(0, 0)).toEqual([0.5, 0.5])
    const north = mercatorXY(0, 60)
    expect(north[1]).toBeLessThan(0.5)
    expect(mercatorXY(180, 0)[0]).toBeCloseTo(1, 6)
  })
})

describe('dataBounds 取景框', () => {
  it('空数据回落到视图边界', () => {
    expect(dataBounds([], 'china')).toEqual([
      [CHINA_BOUNDS.minLng, CHINA_BOUNDS.minLat],
      [CHINA_BOUNDS.maxLng, CHINA_BOUNDS.maxLat],
    ])
    expect(dataBounds([], 'world')).toEqual([
      [WORLD_BOUNDS.minLng, WORLD_BOUNDS.minLat],
      [WORLD_BOUNDS.maxLng, WORLD_BOUNDS.maxLat],
    ])
  })

  it('中国视图忽略境外点（只剩境外点时回落中国框）', () => {
    const overseas = records({ startDate: '2024-01-01', origin: '上海', destination: '巴黎' })
    expect(dataBounds(overseas, 'china')).toEqual([
      [CHINA_BOUNDS.minLng, CHINA_BOUNDS.minLat],
      [CHINA_BOUNDS.maxLng, CHINA_BOUNDS.maxLat],
    ])

    const [min, max] = dataBounds(overseas, 'world')
    expect(min[0]).toBeLessThan(2.3522)
    expect(max[0]).toBeGreaterThan(121.4737)
  })

  it('只框 countsAsVisited 的点，并留出最小跨度', () => {
    const list = records(
      { startDate: '2024-01-01', origin: '上海', destination: '杭州' },
      { startDate: '2024-01-02', origin: '上海', destination: '东京', countsAsVisited: false },
    )
    const [[minLng, minLat], [maxLng, maxLat]] = dataBounds(list, 'world')
    expect(minLng).toBeLessThan(120.1551)
    expect(maxLng).toBeGreaterThan(121.4737)
    expect(minLat).toBeLessThan(30.2741)
    expect(maxLat).toBeGreaterThan(31.2304)
    expect(maxLng - minLng).toBeGreaterThan(1)
  })

  it('fitToRecords 无坐标返回 null', () => {
    expect(fitToRecords([])).toBeNull()
    expect(fitToRecords(records({ startDate: '2024-01-01', origin: '甲', destination: '乙' }))).toBeNull()
  })
})

describe('城市工具', () => {
  it('stripShi / cityKey / titleCase', () => {
    expect(stripShi('上海市')).toBe('上海')
    expect(stripShi(undefined)).toBe('')
    expect(cityKey('深圳北')).toBe('深圳')
    expect(cityKey(' 杭州市 ')).toBe('杭州')
    expect(titleCase('HONG KONG')).toBe('Hong Kong')
    expect(titleCase("XI'AN")).toBe("Xi'an")
  })

  it('inChinaBounds 边界', () => {
    expect(inChinaBounds(116.4, 39.9)).toBe(true)
    expect(inChinaBounds(2.35, 48.85)).toBe(false)
  })
})
