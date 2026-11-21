import type { TravelRecord } from './types'

/** 导出 CSV 的列顺序（也决定导入时的字段名）。 */
export const CSV_HEADER = [
  'startDate',
  'endDate',
  'kind',
  'title',
  'origin',
  'destination',
  'departTime',
  'arriveTime',
  'durationMinutes',
  'transportNo',
  'amountCny',
  'invoiceAmountCny',
  'traveler',
  'people',
  'purpose',
  'project',
  'reimbursement',
  'confidence',
  'countsAsAway',
  'countsAsVisited',
  'showInTimeline',
  'displayLayer',
  'evidence',
  'notes',
] as const

/** 导出的 CSV 带 BOM：否则 Excel 打开中文乱码。 */
export const CSV_BOM = '\uFEFF'

/** 记录 → CSV 文本。数组字段（people）用「 / 」拼接，全部单元格加引号并转义内部引号。 */
export function toCsv(list: readonly TravelRecord[]): string {
  const lines = [CSV_HEADER.join(',')]
  list.forEach((record) => {
    const row = record as unknown as Record<string, unknown>
    lines.push(
      CSV_HEADER.map((key) => {
        const value = Array.isArray(row[key]) ? (row[key] as unknown[]).join(' / ') : (row[key] ?? '')
        return `"${String(value).replaceAll('"', '""')}"`
      }).join(','),
    )
  })
  return lines.join('\n')
}

export function toCsvWithBom(list: readonly TravelRecord[]): string {
  return CSV_BOM + toCsv(list)
}

/**
 * CSV 文本 → 记录数组（首行为表头）。支持引号包裹的逗号/换行/双写转义 `""`，
 * 兼容 CRLF 与 LF，并自动去掉 Excel 导出的 UTF-8 BOM；整行为空的行会被丢掉。
 */
export function parseCsv(rawText: string): Record<string, string>[] {
  const text = String(rawText || '').replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quote = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]
    if (char === '"' && quote && next === '"') {
      cell += '"'
      i += 1
    } else if (char === '"') {
      quote = !quote
    } else if (char === ',' && !quote) {
      row.push(cell)
      cell = ''
    } else if ((char === '\n' || char === '\r') && !quote) {
      if (char === '\r' && next === '\n') i += 1
      row.push(cell)
      if (row.some((value) => value.trim())) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }

  row.push(cell)
  if (row.some((value) => value.trim())) rows.push(row)

  const header = rows.shift() || []
  return rows.map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] || ''])))
}
