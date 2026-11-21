import { OWNER_NAME } from '@/config'

import { CITY, CITY_ALIAS } from './city'
import type { TravelKind, TravelRecord } from './types'

/** 「把票据交给 AI 识别」时复制给用户的提示词。 */
export const AI_RECORD_PROMPT = `请从我上传的车票、机票、行程单、订单截图或报销票据中抽取个人行旅行程。

只输出 JSON，不要输出解释。格式如下：
{
  "records": [
    {
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "kind": "flight | rail | road | stay | cancelled | other",
      "title": "城市A → 城市B",
      "origin": "城市A",
      "destination": "城市B",
      "departTime": "HH:mm",
      "arriveTime": "HH:mm",
      "durationMinutes": 0,
      "transportNo": "车次或航班号",
      "amountCny": 0,
      "traveler": "Nova Kepler",
      "people": ["Nova Kepler"],
      "project": "",
      "confidence": "confirmed | partial | inferred | pending",
      "countsAsAway": true,
      "countsAsVisited": true,
      "showInTimeline": true,
      "displayLayer": "journey",
      "evidence": "票据文件名或来源",
      "notes": "缺失字段或判断依据"
    }
  ]
}

规则：只填票据上能确认的信息；不能确认的字段留空或写 null；退票/改签用 cancelled，且 countsAsAway/countsAsVisited 为 false；城市名写城市，不写具体车站；金额用实际支付金额，发票金额不同则另写 invoiceAmountCny。`

/** 票据文本 → 表单可试填的记录（离线能力，不做图像 OCR）。 */
export function parseTicketText(text: string, traveler = OWNER_NAME): TravelRecord {
  const raw = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!raw) throw new Error('没有可识别文字')

  const dateInfo = extractTicketDate(raw)
  const times = Array.from(raw.matchAll(/(?:^|[^\d])([01]?\d|2[0-3]):([0-5]\d)(?!\d)/g)).map(
    (matched) => `${matched[1].padStart(2, '0')}:${matched[2]}`,
  )
  const transportNo = extractTransportNo(raw)
  const kind = inferKind(transportNo, raw)
  const [origin, destination] = extractCityPair(raw)
  const amountCny = extractAmount(raw)
  const durationMinutes = computeDurationMinutes(dateInfo.value, times[0], dateInfo.value, times[1])
  const notes = [
    '由票据入口试填，请校对原票。',
    dateInfo.note,
    !origin || !destination ? '出发地或到达地待确认。' : '',
    amountCny === null ? '金额待确认。' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return {
    // 票据解析产物只是「表单草稿」：id 在录入页提交时由表单生成（旧版同语义），
    // 这里补空串是为了满足 TravelRecord 的形状，不会被写进数据。
    id: '',
    startDate: dateInfo.value,
    endDate: dateInfo.value,
    kind,
    origin: origin || '',
    destination: destination || '',
    title: [origin, destination].filter(Boolean).join(' → '),
    departTime: times[0] || '',
    arriveTime: times[1] || '',
    durationMinutes,
    transportNo,
    amountCny,
    invoiceAmountCny: null,
    traveler,
    people: [traveler],
    confidence: 'partial',
    countsAsAway: kind !== 'cancelled',
    countsAsVisited: kind !== 'cancelled',
    showInTimeline: true,
    displayLayer: 'journey',
    evidence: '',
    project: '',
    purpose: '',
    reimbursement: '',
    notes,
  }
}

export function extractTicketDate(text: string): { value: string; note: string } {
  const full = text.match(/(20\d{2})\s*[年/\-.]\s*(\d{1,2})\s*[月/\-.]\s*(\d{1,2})\s*日?/)
  if (full) return { value: formatDateParts(full[1], full[2], full[3]), note: '' }

  const compact = text.match(/\b(20\d{2})([01]\d)([0-3]\d)\b/)
  if (compact) return { value: formatDateParts(compact[1], compact[2], compact[3]), note: '' }

  const monthDay = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/)
  if (monthDay) {
    return {
      value: formatDateParts(new Date().getFullYear(), monthDay[1], monthDay[2]),
      note: '票据未见年份，暂按当前年份推定。',
    }
  }

  return { value: '', note: '日期待确认。' }
}

export function formatDateParts(year: string | number, month: string | number, day: string | number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** 车次（GCDZTK 开头）/ 航班号（两字码 + 3~4 位数字）。 */
export function extractTransportNo(text: string): string {
  const train = text.match(/(?:^|[^A-Z0-9])([GCDZTK]\d{1,5})(?![A-Z0-9])/i)
  if (train) return train[1].toUpperCase()
  const flight = text.match(/(?:^|[^A-Z0-9])([A-Z0-9]{2}\d{3,4})(?![A-Z0-9])/i)
  return flight ? flight[1].toUpperCase() : ''
}

export function inferKind(transportNo: string, text: string): TravelKind {
  if (/退票|退款|改签|取消/.test(text)) return 'cancelled'
  if (/^[GCDZTK]\d/i.test(transportNo) || /车次|高铁|动车|火车|铁路|检票口/.test(text)) return 'rail'
  if (transportNo || /航班|登机|机票|机场|舱位/.test(text)) return 'flight'
  return 'other'
}

/** 从票据文本里按出现顺序找前两个城市（先查别名表，再查城市表，最后兜底「XX站/XX机场」）。 */
export function extractCityPair(text: string): string[] {
  const candidates = [
    ...Object.keys(CITY_ALIAS).sort((a, b) => b.length - a.length),
    ...Object.keys(CITY).sort((a, b) => b.length - a.length),
  ]
  const matches: { city: string; index: number }[] = []

  candidates.forEach((candidate) => {
    const index = text.indexOf(candidate)
    if (index >= 0) {
      const city = normalizeCityName(candidate)
      if (city) matches.push({ city, index })
    }
  })

  const found = uniqueCitiesByOrder(matches)
  if (found.length >= 2) return found.slice(0, 2)

  const stationMatches = Array.from(text.matchAll(/([\u4e00-\u9fa5]{2,8})(?:站|机场)/g))
    .map((matched) => ({ city: normalizeCityName(matched[1]), index: matched.index ?? 0 }))
    .filter((matched) => matched.city)

  uniqueCitiesByOrder([...matches, ...stationMatches]).forEach((city) => {
    if (!found.includes(city)) found.push(city)
  })
  return found.slice(0, 2)
}

function uniqueCitiesByOrder(matches: { city: string; index: number }[]): string[] {
  const found: string[] = []
  matches
    .sort((a, b) => a.index - b.index)
    .forEach((match) => {
      if (!found.includes(match.city)) found.push(match.city)
    })
  return found
}

export function normalizeCityName(value: string): string {
  const clean = String(value || '')
    .replace(/[（(].*?[）)]/g, '')
    .replace(/火车站|高铁站|国际机场|机场|车站|站/g, '')
    .trim()
  if (CITY_ALIAS[clean]) return CITY_ALIAS[clean]
  if (CITY[clean]) return clean
  const direct = Object.keys(CITY).find((city) => clean.includes(city))
  if (direct) return direct
  const stripped = clean.replace(/[东西南北]$/, '')
  return CITY[stripped] ? stripped : ''
}

export function extractAmount(text: string): number | null {
  const currency = text.match(/[¥￥]\s*(\d+(?:\.\d{1,2})?)/)
  if (currency) return Number(currency[1])
  const labeled = text.match(/(?:票价|金额|合计|实付|支付|付款)[^\d]{0,10}(\d+(?:\.\d{1,2})?)\s*元?/)
  if (labeled) return Number(labeled[1])
  const yuan = text.match(/(\d+(?:\.\d{1,2})?)\s*元/)
  return yuan ? Number(yuan[1]) : null
}

export function computeDurationMinutes(
  startDate: string | undefined,
  departTime: string | undefined,
  endDate: string | undefined,
  arriveTime: string | undefined,
): number | null {
  if (!departTime || !arriveTime) return null
  const startDay = startDate || '2000-01-01'
  const endDay = endDate || startDay
  const start = new Date(`${startDay}T${departTime}:00`)
  const finish = new Date(`${endDay}T${arriveTime}:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(finish.getTime())) return null
  if (finish < start) finish.setDate(finish.getDate() + 1)
  return Math.max(0, Math.round((finish.getTime() - start.getTime()) / 60000))
}

/* ——— AI JSON 粘贴：从一段文本里抠出 records 数组 ——— */

export function extractJsonCandidate(text: string): string {
  const clean = String(text || '')
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim()
  const firstObject = clean.indexOf('{')
  const firstArray = clean.indexOf('[')
  const starts = [firstObject, firstArray].filter((index) => index >= 0)
  if (!starts.length) return ''
  const start = Math.min(...starts)
  const endObject = clean.lastIndexOf('}')
  const endArray = clean.lastIndexOf(']')
  const end = Math.max(endObject, endArray)
  return end > start ? clean.slice(start, end + 1) : ''
}

export function parseStructuredRecords(text: string): Record<string, unknown>[] {
  const candidate = extractJsonCandidate(text)
  if (!candidate) return []
  const data = JSON.parse(candidate) as unknown
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (data && typeof data === 'object') {
    const bag = data as { records?: unknown; record?: unknown; startDate?: unknown; origin?: unknown }
    if (Array.isArray(bag.records)) return bag.records as Record<string, unknown>[]
    if (bag.record) return [bag.record as Record<string, unknown>]
    if (bag.startDate || bag.origin) return [bag as Record<string, unknown>]
  }
  return []
}

/** 解析失败不抛错：返回空数组，让调用方决定退到 OCR 文本试填。 */
export function tryParseStructuredRecords(text: string): Record<string, unknown>[] {
  try {
    return parseStructuredRecords(text)
  } catch {
    return []
  }
}
