import { describe, expect, it } from 'vitest'

import { OWNER_NAME } from '@/config'

import {
  AI_RECORD_PROMPT,
  computeDurationMinutes,
  extractAmount,
  extractCityPair,
  extractJsonCandidate,
  extractTicketDate,
  extractTransportNo,
  formatDateParts,
  inferKind,
  normalizeCityName,
  parseStructuredRecords,
  parseTicketText,
  tryParseStructuredRecords,
} from './ticket'

describe('parseTicketText 票据文本试填', () => {
  it('高铁票：车次 / 日期 / 时刻 / 城市 / 金额 / 时长', () => {
    const record = parseTicketText(
      '铁路电子客票 G7501 2024-03-19 上海虹桥 09:11 开 10:08 到 杭州东 二等座 ¥73.0 检票口 6A',
    )

    expect(record.kind).toBe('rail')
    expect(record.transportNo).toBe('G7501')
    expect(record.startDate).toBe('2024-03-19')
    expect(record.endDate).toBe('2024-03-19')
    expect(record.origin).toBe('上海')
    expect(record.destination).toBe('杭州')
    expect(record.departTime).toBe('09:11')
    expect(record.arriveTime).toBe('10:08')
    expect(record.durationMinutes).toBe(57)
    expect(record.amountCny).toBe(73)
    expect(record.title).toBe('上海 → 杭州')
    expect(record.traveler).toBe(OWNER_NAME)
    expect(record.people).toEqual([OWNER_NAME])
    expect(record.confidence).toBe('partial')
    expect(record.countsAsAway).toBe(true)
    expect(record.notes).toContain('请校对原票')
  })

  it('机票：两字码 + 数字识别为航班，跨夜时长按次日算', () => {
    const record = parseTicketText('航班 MU5101 2024-03-20 上海浦东 23:30 东京 06:20 登机口 206')
    expect(record.kind).toBe('flight')
    expect(record.transportNo).toBe('MU5101')
    expect(record.origin).toBe('上海')
    expect(record.destination).toBe('东京')
    expect(record.durationMinutes).toBe(410)
  })

  it('退票 / 改签 → cancelled，且不点亮、不计在外', () => {
    const record = parseTicketText('退票 G7501 2024-03-19 上海虹桥 09:11 杭州东 退票费 ¥5')
    expect(record.kind).toBe('cancelled')
    expect(record.countsAsAway).toBe(false)
    expect(record.countsAsVisited).toBe(false)
  })

  it('没年份的票据按当前年份推定并写进备注', () => {
    const year = new Date().getFullYear()
    const record = parseTicketText('3月19日 上海 杭州')
    expect(record.startDate).toBe(`${year}-03-19`)
    expect(record.notes).toContain('暂按当前年份推定')
  })

  it('缺信息时留空 + 备注提醒，不臆造', () => {
    const record = parseTicketText('不知道是什么票据')
    expect(record.kind).toBe('other')
    expect(record.startDate).toBe('')
    expect(record.origin).toBe('')
    expect(record.destination).toBe('')
    expect(record.amountCny).toBeNull()
    expect(record.durationMinutes).toBeNull()
    expect(record.notes).toContain('日期待确认')
    expect(record.notes).toContain('出发地或到达地待确认')
    expect(record.notes).toContain('金额待确认')
  })

  it('空文本抛错（录入页据此提示）', () => {
    expect(() => parseTicketText('   ')).toThrow('没有可识别文字')
  })
})

describe('票据解析的各个分支', () => {
  it('extractTicketDate：yyyy-mm-dd / 紧凑 / 月日', () => {
    expect(extractTicketDate('2024-03-19 出发')).toEqual({ value: '2024-03-19', note: '' })
    expect(extractTicketDate('2024年3月9日')).toEqual({ value: '2024-03-09', note: '' })
    expect(extractTicketDate('20240319').value).toBe('2024-03-19')
    expect(extractTicketDate('3月9日').value.endsWith('-03-09')).toBe(true)
    expect(extractTicketDate('无日期').value).toBe('')
  })

  it('extractTransportNo：车次优先于航班号', () => {
    expect(extractTransportNo('G7501')).toBe('G7501')
    expect(extractTransportNo('D3105 次')).toBe('D3105')
    expect(extractTransportNo('CA1883')).toBe('CA1883')
    expect(extractTransportNo('MU5101')).toBe('MU5101')
    expect(extractTransportNo('没有编号')).toBe('')
  })

  it('inferKind：退改 > 铁路 > 航班 > 其他', () => {
    expect(inferKind('G1', '退票')).toBe('cancelled')
    expect(inferKind('G1', '')).toBe('rail')
    expect(inferKind('', '高铁二等座')).toBe('rail')
    expect(inferKind('MU5101', '')).toBe('flight')
    expect(inferKind('', '登机牌')).toBe('flight')
    expect(inferKind('', '景区门票')).toBe('other')
  })

  it('extractCityPair：车站别名归一、按出现顺序取前两个', () => {
    expect(extractCityPair('上海虹桥 → 杭州东')).toEqual(['上海', '杭州'])
    expect(extractCityPair('北京南 到 深圳北')).toEqual(['北京', '深圳'])
    expect(extractCityPair('只有上海')).toEqual(['上海'])
  })

  it('normalizeCityName：去掉站名后缀并查别名表', () => {
    expect(normalizeCityName('上海虹桥站')).toBe('上海')
    expect(normalizeCityName('杭州东')).toBe('杭州')
    expect(normalizeCityName('北京市')).toBe('北京')
    expect(normalizeCityName('不存在的地方')).toBe('')
  })

  it('extractAmount：¥ / 关键词 / 「元」三种写法', () => {
    expect(extractAmount('¥73.0')).toBe(73)
    expect(extractAmount('实付 128 元')).toBe(128)
    expect(extractAmount('票价 45.5 元')).toBe(45.5)
    expect(extractAmount('没有金额')).toBeNull()
  })

  it('computeDurationMinutes：缺时刻为 null，跨夜进位', () => {
    expect(computeDurationMinutes('2024-01-01', '', '2024-01-01', '10:00')).toBeNull()
    expect(computeDurationMinutes('2024-01-01', '09:00', '2024-01-01', '10:30')).toBe(90)
    expect(computeDurationMinutes('2024-01-01', '23:00', '2024-01-01', '01:00')).toBe(120)
  })

  it('formatDateParts 补零', () => {
    expect(formatDateParts(2024, '3', '9')).toBe('2024-03-09')
  })
})

describe('AI JSON 粘贴解析', () => {
  const payload = '{"records":[{"startDate":"2024-01-01","origin":"上海","destination":"杭州"}]}'

  it('从 ```json 代码块里抠出 JSON', () => {
    const text = '```json\n' + payload + '\n```'
    expect(extractJsonCandidate(text)).toBe(payload)
    expect(parseStructuredRecords(text)).toHaveLength(1)
  })

  it('兼容数组 / {records} / {record} / 单条记录 四种形状', () => {
    expect(parseStructuredRecords('[{"startDate":"2024-01-01"}]')).toHaveLength(1)
    expect(parseStructuredRecords(payload)).toHaveLength(1)
    expect(parseStructuredRecords('{"record":{"startDate":"2024-01-01"}}')).toHaveLength(1)
    expect(parseStructuredRecords('{"startDate":"2024-01-01","origin":"上海"}')).toHaveLength(1)
  })

  it('没有 JSON / JSON 坏掉都返回空数组（不抛错）', () => {
    expect(parseStructuredRecords('没有任何结构化数据')).toEqual([])
    expect(tryParseStructuredRecords('{ 不是 JSON }')).toEqual([])
    expect(extractJsonCandidate('无花括号')).toBe('')
  })

  it('提示词是静态常量，不会随数据变化', () => {
    expect(AI_RECORD_PROMPT).toContain('只输出 JSON')
    expect(AI_RECORD_PROMPT).toContain(OWNER_NAME)
  })
})
