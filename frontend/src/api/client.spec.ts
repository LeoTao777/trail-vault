import { describe, expect, it, vi } from 'vitest'

import {
  clearCachedRecords,
  createTravelRecord,
  fetchAllTravelRecords,
  fetchUsers,
  loadRecords,
  pushRecordsToBackend,
  readCachedRecords,
  writeCachedRecords,
  type StorageLike,
} from './client'

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  const storage: StorageLike & { dump: () => Map<string, string> } = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value)
    },
    removeItem: (key) => {
      map.delete(key)
    },
    dump: () => map,
  }
  return storage
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response
}

const fetchReturning = (response: Response | (() => Promise<Response>)) =>
  (typeof response === 'function' ? response : async () => response) as unknown as typeof fetch

const fetchFailing = (message = 'offline') =>
  (async () => {
    throw new Error(message)
  }) as unknown as typeof fetch

describe('fetchAllTravelRecords / fetchUsers', () => {
  it('记录接口兼容 {records, metadata} 与裸数组两种形状', async () => {
    const wrapped = await fetchAllTravelRecords(
      fetchReturning(jsonResponse({ records: [{ id: 'a' }], metadata: { lastUpdated: '2025-12-01' } })),
    )
    expect(wrapped.records).toEqual([{ id: 'a' }])
    expect(wrapped.metadata.lastUpdated).toBe('2025-12-01')

    const bare = await fetchAllTravelRecords(fetchReturning(jsonResponse([{ id: 'b' }])))
    expect(bare.records).toEqual([{ id: 'b' }])
    expect(bare.metadata).toEqual({})
  })

  it('HTTP 非 2xx 抛错（错误归一，带状态码）', async () => {
    await expect(fetchAllTravelRecords(fetchReturning(jsonResponse(null, false, 500)))).rejects.toThrow(
      '旅行记录读取失败：HTTP 500',
    )
    await expect(fetchUsers(fetchReturning(jsonResponse(null, false, 502)))).rejects.toThrow(
      '用户列表读取失败：HTTP 502',
    )
  })

  it('用户接口兼容 {users} 与裸数组', async () => {
    expect(await fetchUsers(fetchReturning(jsonResponse({ users: ['a'] })))).toEqual(['a'])
    expect(await fetchUsers(fetchReturning(jsonResponse([{ username: 'b' }])))).toEqual([{ username: 'b' }])
  })
})

describe('loadRecords 三级回退', () => {
  const record = { startDate: '2024-01-01', origin: '上海', destination: '杭州' }

  it('① 后端可用：以后端为准，并把归一化结果写进本机缓存', async () => {
    const storage = memoryStorage()
    const loaded = await loadRecords({
      fetchImpl: fetchReturning(jsonResponse({ records: [record], metadata: { lastUpdated: '2025-12-01' } })),
      storage,
    })

    expect(loaded.source).toBe('backend')
    expect(loaded.records).toHaveLength(1)
    expect(loaded.records[0].title).toBe('上海 → 杭州')
    expect(loaded.message).toBe('2025-12-01 资料，1 条行程 · 来自后端')
    expect(readCachedRecords(storage)).toHaveLength(1)
  })

  it('② 后端不可用：回退上一次成功拉取的本机缓存', async () => {
    const storage = memoryStorage()
    writeCachedRecords(
      [
        {
          id: 'cached-1',
          startDate: '2024-02-01',
          endDate: '2024-02-01',
          kind: 'rail',
          title: '缓存 → 记录',
        } as never,
      ],
      storage,
    )

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const loaded = await loadRecords({ fetchImpl: fetchFailing(), storage })
    errorSpy.mockRestore()

    expect(loaded.source).toBe('cache')
    expect(loaded.records).toHaveLength(1)
    expect(loaded.message).toBe('后端未连接，使用本机缓存，1 条行程')
  })

  it('③ 缓存也没有：回退内置演示数据（断网也能看到东西）', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const loaded = await loadRecords({
      fetchImpl: fetchFailing(),
      storage: memoryStorage(),
      fallback: [record],
    })
    errorSpy.mockRestore()

    expect(loaded.source).toBe('builtin')
    expect(loaded.records).toHaveLength(1)
    expect(loaded.message).toBe('后端未连接，使用内置资料，1 条行程')
  })

  it('缓存坏掉时当作没有缓存，继续回退内置数据', async () => {
    const storage = memoryStorage({ journeyatlas_records_v1: '{ 坏掉的 JSON' })
    expect(readCachedRecords(storage)).toBeNull()

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const loaded = await loadRecords({ fetchImpl: fetchFailing(), storage, fallback: [record] })
    errorSpy.mockRestore()
    expect(loaded.source).toBe('builtin')
  })

  it('storage 传 null 时不读写浏览器缓存（隐私模式/单测）', async () => {
    const loaded = await loadRecords({
      fetchImpl: fetchReturning(jsonResponse({ records: [record] })),
      storage: null,
    })
    expect(loaded.source).toBe('backend')
    expect(loaded.records).toHaveLength(1)
  })

  it('clearCachedRecords 清空缓存', () => {
    const storage = memoryStorage({ journeyatlas_records_v1: '[]' })
    clearCachedRecords(storage)
    expect(readCachedRecords(storage)).toBeNull()
  })
})

describe('createTravelRecord / pushRecordsToBackend', () => {
  it('成功时返回服务端落库后的记录', async () => {
    const saved = await createTravelRecord(
      { startDate: '2024-01-01' },
      fetchReturning(jsonResponse({ record: { id: 'server-1', startDate: '2024-01-01' } })),
    )
    expect(saved.id).toBe('server-1')
  })

  it('服务端没回 record 时退回原记录（不丢这次录入）', async () => {
    const saved = await createTravelRecord({ startDate: '2024-01-01' }, fetchReturning(jsonResponse({})))
    expect(saved.startDate).toBe('2024-01-01')
  })

  it('失败时抛出带状态码与响应体的错误', async () => {
    await expect(
      createTravelRecord(
        { startDate: '2024-01-01' },
        fetchReturning(jsonResponse('bad request', false, 400)),
      ),
    ).rejects.toThrow('创建行程失败：HTTP 400 · bad request')
  })

  it('批量导入：成功项与失败项分别统计', async () => {
    let call = 0
    const fetchImpl = (async () => {
      call += 1
      return call === 1 ? jsonResponse({ record: { id: 'ok-1' } }) : jsonResponse('boom', false, 500)
    }) as unknown as typeof fetch

    const result = await pushRecordsToBackend(
      [{ startDate: '2024-01-01' }, { startDate: '2024-01-02' }],
      fetchImpl,
    )
    expect(result.created).toEqual([{ id: 'ok-1' }])
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0].error.message).toContain('HTTP 500')
  })
})
