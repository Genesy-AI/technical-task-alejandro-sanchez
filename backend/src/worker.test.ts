import { PrismaClient } from '@prisma/client'
import { NativeConnection, Worker, WorkerOptions } from '@temporalio/worker'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runTemporalWorker } from './worker'

vi.mock('@temporalio/worker', () => ({
  NativeConnection: { connect: vi.fn() },
  Worker: { create: vi.fn() },
}))

const connect = vi.mocked(NativeConnection.connect)
const createWorker = vi.mocked(Worker.create)
const prisma = {} as PrismaClient

// Fake values only.
const completeEnv: Record<string, string> = {
  ORION_CONNECT_API_KEY: 'fake-orion-key',
  ORION_CONNECT_BASE_URL: 'https://orion.test/orionConnect',
  ASTRA_DIALER_API_KEY: 'fake-astra-key',
  ASTRA_DIALER_BASE_URL: 'https://astra.test/astraDialer',
  NIMBUS_LOOKUP_API_KEY: 'fake-nimbus-key',
  NIMBUS_LOOKUP_BASE_URL: 'https://nimbus.test/numbusLookup',
}

function stubEnv(env: Record<string, string>): void {
  Object.entries(env).forEach(([name, value]) => vi.stubEnv(name, value))
}

function createdOptions(): WorkerOptions[] {
  return createWorker.mock.calls.map(([options]) => options)
}

beforeEach(() => {
  connect.mockResolvedValue({ close: vi.fn(async () => undefined) } as unknown as NativeConnection)
  createWorker.mockResolvedValue({ run: vi.fn(async () => undefined) } as unknown as Worker)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('runTemporalWorker', () => {
  it('does not connect when a key is missing, and names the variable', async () => {
    stubEnv({ ...completeEnv, ASTRA_DIALER_API_KEY: '' })

    await expect(runTemporalWorker(prisma)).rejects.toThrow(
      'Missing phone provider configuration: ASTRA_DIALER_API_KEY'
    )
    expect(connect).not.toHaveBeenCalled()
  })

  it('starts the main worker and one worker for each provider queue', async () => {
    stubEnv(completeEnv)

    await runTemporalWorker(prisma)

    expect(createdOptions().map((options) => options.taskQueue)).toEqual([
      'myQueue',
      'phone-orion-connect',
      'phone-astra-dialer',
      'phone-nimbus-lookup',
    ])
    expect(Object.keys(createdOptions()[0].activities ?? {})).toEqual(['verifyEmail', 'savePhoneEnrichment'])
    expect(Object.keys(createdOptions()[1].activities ?? {})).toEqual(['lookupPhoneWithOrionConnect'])
  })

  it('sets a queue rate limit only for a provider with a configured limit', async () => {
    stubEnv({ ...completeEnv, NIMBUS_LOOKUP_MAX_REQUESTS_PER_SECOND: '5' })

    await runTemporalWorker(prisma)

    const limits = createdOptions().map((options) => options.maxTaskQueueActivitiesPerSecond)
    expect(limits).toEqual([undefined, undefined, undefined, 5])
  })
})
