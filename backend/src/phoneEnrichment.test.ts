import { Client } from '@temporalio/client'
import { TestWorkflowEnvironment } from '@temporalio/testing'
import { DefaultLogger, Runtime } from '@temporalio/worker'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  LeadToEnrich,
  PhoneEnrichmentDependencies,
  readLeadIds,
  startLeadPhoneEnrichments,
  startPhoneEnrichmentWorkflow,
} from './phoneEnrichment'

// The first run downloads the Temporal test server binary.
const SETUP_TIMEOUT_MS = 120_000

const baseLead: LeadToEnrich = {
  id: 1,
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@acme.com',
  jobTitle: 'CTO',
  phoneNumber: null,
  phoneEnrichmentStatus: null,
}
const leadWithPhone: LeadToEnrich = { ...baseLead, id: 2, firstName: 'Alan', phoneNumber: '(731)123-9702' }
const failedBefore: LeadToEnrich = { ...baseLead, id: 3, lastName: 'Byron', phoneEnrichmentStatus: 'failed' }

interface Deferred {
  promise: Promise<void>
  resolve: () => void
}

function makeDeferred(): Deferred {
  let resolve: () => void = () => undefined
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function makeDependencies(
  startEnrichment: PhoneEnrichmentDependencies['startEnrichment'] = async () => undefined
): PhoneEnrichmentDependencies {
  return { saveStatus: vi.fn(async () => undefined), startEnrichment: vi.fn(startEnrichment) }
}

describe('startLeadPhoneEnrichments', () => {
  it('skips a lead that already has a phone and counts it', async () => {
    const dependencies = makeDependencies()

    const report = await startLeadPhoneEnrichments([baseLead, leadWithPhone], dependencies)

    expect(report).toEqual({ success: true, startedCount: 1, skippedWithPhoneCount: 1, errors: [] })
    expect(dependencies.startEnrichment).toHaveBeenCalledTimes(1)
    expect(dependencies.startEnrichment).toHaveBeenCalledWith(baseLead)
    expect(dependencies.saveStatus).not.toHaveBeenCalledWith(leadWithPhone.id, expect.anything())
  })

  it('sets each lead to running before its workflow starts', async () => {
    const dependencies = makeDependencies(async (lead) => {
      expect(dependencies.saveStatus).toHaveBeenCalledWith(lead.id, 'running')
    })

    const report = await startLeadPhoneEnrichments([baseLead], dependencies)

    expect(report.startedCount).toBe(1)
  })

  it('starts all workflows before any start ends', async () => {
    const pending = [makeDeferred(), makeDeferred()]
    const dependencies = makeDependencies((lead) => pending[lead.id === baseLead.id ? 0 : 1].promise)

    const report = startLeadPhoneEnrichments([baseLead, failedBefore], dependencies)
    await vi.waitFor(() => expect(dependencies.startEnrichment).toHaveBeenCalledTimes(2))

    pending.forEach((deferred) => deferred.resolve())
    await expect(report).resolves.toMatchObject({ startedCount: 2 })
  })

  it('puts the earlier status back and reports the lead when its workflow cannot start', async () => {
    const dependencies = makeDependencies(async (lead) => {
      if (lead.id === failedBefore.id) {
        throw new Error('Temporal is down')
      }
    })

    const report = await startLeadPhoneEnrichments([baseLead, failedBefore], dependencies)

    expect(report).toEqual({
      success: true,
      startedCount: 1,
      skippedWithPhoneCount: 0,
      errors: [{ leadId: 3, leadName: 'Ada Byron', error: 'Temporal is down' }],
    })
    expect(dependencies.saveStatus).toHaveBeenLastCalledWith(failedBefore.id, 'failed')
  })
})

describe('readLeadIds', () => {
  it('reads a list of whole-number ids', () => {
    expect(readLeadIds({ leadIds: [1, '2', 3] })).toEqual([1, 2, 3])
  })

  it.each([
    undefined,
    null,
    {},
    { leadIds: [] },
    { leadIds: 'all' },
    { leadIds: [1, 'x'] },
    { leadIds: [1.5] },
    { leadIds: [null] },
    { leadIds: [''] },
  ])('returns null for %j', (body) => {
    expect(readLeadIds(body)).toBeNull()
  })
})

describe('startPhoneEnrichmentWorkflow', () => {
  let testEnv: TestWorkflowEnvironment

  beforeAll(async () => {
    Runtime.install({ logger: new DefaultLogger('WARN') })
    testEnv = await TestWorkflowEnvironment.createTimeSkipping()
  }, SETUP_TIMEOUT_MS)

  afterAll(async () => {
    await testEnv?.teardown()
  })

  it('joins the running workflow when the same lead is enriched twice', async () => {
    // No worker polls the queue, so the first run stays open.
    const client = new Client({ connection: testEnv.connection })
    const handle = client.workflow.getHandle(`enrich-phone-${baseLead.id}`)

    await startPhoneEnrichmentWorkflow(client, baseLead)
    const firstRun = await handle.describe()
    await startPhoneEnrichmentWorkflow(client, baseLead)
    const secondRun = await handle.describe()

    expect(secondRun.runId).toBe(firstRun.runId)
    expect(secondRun.status.name).toBe('RUNNING')
    const history = await handle.fetchHistory()
    const payloads = history.events?.[0]?.workflowExecutionStartedEventAttributes?.input?.payloads ?? []
    const args: unknown[] = payloads.map((payload) => JSON.parse(Buffer.from(payload.data ?? []).toString()))
    expect(args).toEqual([{ leadId: 1, fullName: 'Ada Lovelace', email: 'ada@acme.com', jobTitle: 'CTO' }])
  })
})
