import { Connection } from '@temporalio/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { closeTemporalClient, getTemporalClient } from './temporalClient'

vi.mock('@temporalio/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@temporalio/client')>()
  return { ...original, Connection: { connect: vi.fn() } }
})

const connect = vi.mocked(Connection.connect)

function makeFakeConnection(): Connection {
  return { close: vi.fn(async () => undefined) } as unknown as Connection
}

afterEach(async () => {
  await closeTemporalClient()
  connect.mockReset()
})

describe('getTemporalClient', () => {
  it('opens one connection for all callers, also for concurrent first calls', async () => {
    connect.mockResolvedValue(makeFakeConnection())

    const [first, second] = await Promise.all([getTemporalClient(), getTemporalClient()])
    const third = await getTemporalClient()

    expect(connect).toHaveBeenCalledTimes(1)
    expect(connect).toHaveBeenCalledWith({ address: 'localhost:7233' })
    expect(second).toBe(first)
    expect(third).toBe(first)
  })

  it('connects again on the next call after a failed connection attempt', async () => {
    connect.mockRejectedValueOnce(new Error('Temporal is down')).mockResolvedValue(makeFakeConnection())

    await expect(getTemporalClient()).rejects.toThrow('Temporal is down')
    await expect(getTemporalClient()).resolves.toBeDefined()

    expect(connect).toHaveBeenCalledTimes(2)
  })
})

describe('closeTemporalClient', () => {
  it('closes the shared connection, and the next call opens a new one', async () => {
    const connection = makeFakeConnection()
    connect.mockResolvedValue(connection)
    await getTemporalClient()

    await closeTemporalClient()
    await getTemporalClient()

    expect(connection.close).toHaveBeenCalledTimes(1)
    expect(connect).toHaveBeenCalledTimes(2)
  })
})
