import type { RawRecord, RecordMetadata } from '@/domain/types'

/**
 * 内置演示数据（断网兜底）。
 *
 * 来源：旧版 `frontend/data/travel-log-data.js` 里的 `window.TRAVEL_LOG_DATA`，
 * 与同名 `travel-log.json` 内容一致。这里直接 import 同名 JSON（构建期打进 bundle），
 * 所以 P7 删除旧版 `data/` 之前要把这份 JSON 挪到 `src/data/`，否则这里会失效。
 */
import travelLog from '../../data/travel-log.json'

interface TravelLogFile {
  metadata?: RecordMetadata
  records?: RawRecord[]
}

const data = travelLog as unknown as TravelLogFile

export const fallbackMetadata: RecordMetadata = data.metadata ?? {}

export const fallbackRecords: RawRecord[] = Array.isArray(data.records) ? data.records : []

export default data
