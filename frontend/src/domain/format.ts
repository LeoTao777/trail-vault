import { cityMeta, cityKey, stripShi } from './city'
import type { TravelRecord } from './types'

/** 本地日期格式化：本地午夜 + toISOString(UTC) 在东八区会整体偏移成「前一天」，故手写。 */
function formatDayLocal(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** 含首尾的日期区间（逐天枚举）。任一日期非法返回空数组。 */
export function daysBetween(start: string | undefined, end?: string | null): string[] {
  if (!start) return []
  const days: string[] = []
  const cursor = new Date(`${start}T00:00:00`)
  const finish = new Date(`${end || start}T00:00:00`)
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(finish.getTime())) return days
  for (const day = new Date(cursor); day <= finish; day.setDate(day.getDate() + 1)) {
    days.push(formatDayLocal(day))
  }
  return days
}

/** 住几晚：到达日到离开日之间「含首尾日数 − 1」。 */
export function stayNights(record: Pick<TravelRecord, 'startDate' | 'endDate'>): number {
  return Math.max(0, daysBetween(record.startDate, record.endDate).length - 1)
}

export function dateRange(record: Pick<TravelRecord, 'startDate' | 'endDate'> | null | undefined): string {
  if (!record?.startDate) return '-'
  return record.startDate === record.endDate ? record.startDate : `${record.startDate} ~ ${record.endDate}`
}

/** 标题显示层归一：`->` → `→`；stay 记录的「X → X」统一成「X停留」。 */
export function displayTitle(record: Pick<TravelRecord, 'title' | 'kind'> | null | undefined): string {
  const title = String(record?.title || '').replaceAll(' -> ', ' → ')
  if (record?.kind === 'stay') {
    const matched = /^(.+?)\s*→\s*(.+)$/.exec(title)
    if (matched && stripShi(matched[1].trim()) === stripShi(matched[2].trim())) {
      return `${stripShi(matched[1].trim())}停留`
    }
  }
  return title
}

/**
 * 金额。空值在「展示模式」下安静省略，工作台里喊「待补」。
 * showMode 旧版是全局变量，这里显式传参（store 持有）。
 */
export function money(value: number | null | undefined, showMode = false): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return showMode ? '' : '待补'
  return `¥${Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`
}

/** 时长（分钟 → 「X 小时 Y 分」）。 */
export function duration(minutes: number | null | undefined, showMode = false): string {
  if (minutes === null || minutes === undefined || Number.isNaN(Number(minutes))) {
    return showMode ? '' : '待补'
  }
  const hours = Math.floor(minutes / 60)
  const remain = minutes % 60
  if (!hours) return `${remain} 分`
  return remain ? `${hours} 小时 ${remain} 分` : `${hours} 小时`
}

const CHINA_COUNTRIES = new Set(['中国', '中国香港', '中国澳门'])

/** 跨境（跨大时区）判断：国际航班「12:00→06:00」不是时间倒流，要标「当地」。 */
export function isCrossTimezone(record: Pick<TravelRecord, 'origin' | 'destination'>): boolean {
  const from = cityMeta(cityKey(record.origin)).country
  const to = cityMeta(cityKey(record.destination)).country
  return (Boolean(from) && !CHINA_COUNTRIES.has(from)) || (Boolean(to) && !CHINA_COUNTRIES.has(to))
}

/**
 * 行程时间标签：「12:00–06:00 +1天 当地」。
 * 跨夜补「+N天」（endDate 未进位时按「到达 < 出发」兜底），跨境补「当地」。
 */
export function tripTimeText(record: TravelRecord): string {
  const depart = String(record.departTime || '').trim()
  const arrive = String(record.arriveTime || '').trim()
  if (!depart && !arrive) return ''
  if (!depart || !arrive) return depart || arrive

  // 时刻一律折成分钟数再比较：「9:30」vs「12:00」这类未补零的手填值用字符串比较会误判跨夜
  const toMinutes = (time: string) => {
    const matched = /^(\d{1,2}):(\d{2})$/.exec(time)
    return matched ? Number(matched[1]) * 60 + Number(matched[2]) : Number.NaN
  }
  const departMin = toMinutes(depart)
  const arriveMin = toMinutes(arrive)
  const arriveEarlier =
    Number.isFinite(departMin) && Number.isFinite(arriveMin) ? arriveMin < departMin : arrive < depart

  const span = daysBetween(record.startDate, record.endDate)
  let delta = Array.isArray(span) ? Math.max(0, span.length - 1) : 0
  if (delta <= 0 && arriveEarlier) delta = 1 // 跨夜但 endDate 未进位
  // 移动段日期跨度异常大（合并录入）时不显示夸张的 +N天
  if (delta > 1 && !arriveEarlier && record.kind !== 'stay') delta = 0

  let text = `${depart}–${arrive}`
  if (delta > 0) text += ` +${delta}天`
  if (isCrossTimezone(record)) text += ' 当地'
  return text
}

/** en-US 千分位（旧版累计里程 / 里程副标题用）。 */
export function formatNumber(value: number): string {
  return value.toLocaleString('en-US')
}

/** 里程展示：「1.2万」或千分位数字。 */
export function formatKm(km: number): string {
  return km >= 10000 ? `${(km / 10000).toFixed(1)}万` : formatNumber(km)
}
