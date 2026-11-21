import { describe, expect, it } from 'vitest'

import { records } from '@/test/records'

import { CSV_BOM, CSV_HEADER, parseCsv, toCsv, toCsvWithBom } from './csv'

const sample = () =>
  records(
    {
      startDate: '2024-01-01',
      endDate: '2024-01-02',
      origin: '上海',
      destination: '杭州',
      transportNo: 'G7501',
      amountCny: 73.5,
      durationMinutes: 57,
      people: ['Nova Kepler', '林叙'],
      confidence: 'confirmed',
      notes: '含逗号, 引号"与换行\n的备注',
    },
    { startDate: '2024-02-01', origin: '杭州', destination: '上海' },
  )

describe('toCsv', () => {
  it('表头固定、每格都加引号、people 用「 / 」拼接', () => {
    const csv = toCsv(sample())
    const [header, firstRow] = csv.split('\n')
    expect(header).toBe(CSV_HEADER.join(','))
    expect(firstRow).toContain('"Nova Kepler / 林叙"')
    expect(firstRow.startsWith('"2024-01-01"')).toBe(true)
  })

  it('内部引号双写转义', () => {
    const csv = toCsv(sample())
    expect(csv).toContain('引号""与换行')
  })

  it('导出带 BOM（Excel 中文不乱码）', () => {
    expect(toCsvWithBom(sample()).startsWith(CSV_BOM)).toBe(true)
    expect(toCsv(sample()).startsWith(CSV_BOM)).toBe(false)
  })
})

describe('parseCsv', () => {
  it('往返：导出再导入字段不丢（含逗号/引号/换行）', () => {
    const original = sample()
    const parsed = parseCsv(toCsvWithBom(original))

    expect(parsed).toHaveLength(2)
    expect(parsed[0].startDate).toBe('2024-01-01')
    expect(parsed[0].endDate).toBe('2024-01-02')
    expect(parsed[0].origin).toBe('上海')
    expect(parsed[0].destination).toBe('杭州')
    expect(parsed[0].transportNo).toBe('G7501')
    expect(parsed[0].amountCny).toBe('73.5')
    expect(parsed[0].durationMinutes).toBe('57')
    expect(parsed[0].people).toBe('Nova Kepler / 林叙')
    expect(parsed[0].notes).toBe('含逗号, 引号"与换行\n的备注')
  })

  it('兼容 CRLF 与 LF，丢弃空行', () => {
    const text = 'a,b\r\n1,2\r\n\r\n3,4\n'
    expect(parseCsv(text)).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ])
  })

  it('缺列时补空串', () => {
    expect(parseCsv('a,b,c\n1,2')).toEqual([{ a: '1', b: '2', c: '' }])
  })

  it('空文本返回空数组', () => {
    expect(parseCsv('')).toEqual([])
  })
})
