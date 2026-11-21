import { randomUUID } from 'crypto'
import path from 'path'
import { ApplicationFailure } from '@temporalio/client'
import { TestWorkflowEnvironment } from '@temporalio/testing'
import {
  bundleWorkflowCode,
  DefaultLogger,
  Runtime,
  Worker,
  WorkflowBundleWithSourceMap,
} from '@temporalio/worker'
import { afterAll, beforeAll, describe, expect, it, Mock, vi } from 'vitest'
import { PHONE_PROVIDER_CHAIN, PhoneLookupActivityName } from '../phoneProviders/registry'
import { PhoneEnrichmentOutcome, PhoneLookupLead, PhoneLookupResult } from '../phoneProviders/types'
import { EnrichPhoneInput, enrichPhoneWorkflow } from './enrichPhoneWorkflow'

const WORKFLOW_TASK_QUEUE = 'enrich-phone-test'
// Load the same barrel as the real worker. Vitest cannot `require.resolve` a .ts file.
const WORKFLOWS_PATH = path.join(__dirname, 'index.ts')
// The first run downloads the Temporal test server binary.
const SETUP_TIMEOUT_MS = 120_000
const TEST_TIMEOUT_MS = 60_000

type LookupMock = Mock<(lead: PhoneLookupLead) => Promise<PhoneLookupResult>>
type SaveMock = Mock<(leadId: number, outcome: PhoneEnrichmentOutcome) => Promise<void>>
type LookupMocks = Record<PhoneLookupActivityName, LookupMock>

const input: EnrichPhoneInput = {
  leadId: 7,
  fullName: 'Ada Lovelace',
  email: 'ada@acme.com',
  jobTitle: 'CTO',
}
const notFound = async (): Promise<PhoneLookupResult> => ({ status: 'not_found' })
const alwaysFails = async (): Promise<PhoneLookupResult> => {
  throw new Error('Provider is down')
}

let testEnv: TestWorkflowEnvironment
let workflowBundle: WorkflowBundleWithSourceMap

beforeAll(async () => {
  Runtime.install({ logger: new DefaultLogger('WARN') })
  testEnv = await TestWorkflowEnvironment.createTimeSkipping()
  // Bundle one time. Each test creates new workers.
  workflowBundle = await bundleWorkflowCode({
    workflowsPath: WORKFLOWS_PATH,
    logger: new DefaultLogger('WARN'),
  })
}, SETUP_TIMEOUT_MS)

afterAll(async () => {
  await testEnv?.teardown()
})

function makeLookupMocks(overrides: Partial<Record<PhoneLookupActivityName, LookupMock>>): LookupMocks {
  return {
    lookupPhoneWithOrionConnect: overrides.lookupPhoneWithOrionConnect ?? vi.fn(notFound),
    lookupPhoneWithAstraDialer: overrides.lookupPhoneWithAstraDialer ?? vi.fn(notFound),
    lookupPhoneWithNimbusLookup: overrides.lookupPhoneWithNimbusLookup ?? vi.fn(notFound),
  }
}

// Starts each worker in turn. The innermost call runs the workflow, then all workers shut down.
async function runWithWorkers<T>(workers: Worker[], run: () => Promise<T>): Promise<T> {
  const [first, ...rest] = workers
  if (!first) {
    return run()
  }
  return first.runUntil(runWithWorkers(rest, run))
}

async function createWorkers(lookups: LookupMocks, savePhoneEnrichment: SaveMock): Promise<Worker[]> {
  const connection = testEnv.nativeConnection
  const providerWorkers = PHONE_PROVIDER_CHAIN.map((step) =>
    Worker.create({
      connection,
      taskQueue: step.taskQueue,
      activities: { [step.activityName]: lookups[step.activityName] },
    })
  )
  const mainWorker = Worker.create({
    connection,
    taskQueue: WORKFLOW_TASK_QUEUE,
    workflowBundle,
    activities: { savePhoneEnrichment },
  })
  return Promise.all([mainWorker, ...providerWorkers])
}

async function runEnrichPhone(
  lookups: LookupMocks
): Promise<{ outcome: PhoneEnrichmentOutcome; save: SaveMock }> {
  const save: SaveMock = vi.fn(async () => undefined)
  const workers = await createWorkers(lookups, save)
  const outcome = await runWithWorkers(workers, () =>
    testEnv.client.workflow.execute(enrichPhoneWorkflow, {
      taskQueue: WORKFLOW_TASK_QUEUE,
      workflowId: `enrich-phone-test-${randomUUID()}`,
      args: [input],
    })
  )
  return { outcome, save }
}

describe('enrichPhoneWorkflow', () => {
  it(
    'stops at Orion when it finds a phone, and saves found with orionConnect',
    async () => {
      const lookups = makeLookupMocks({
        lookupPhoneWithOrionConnect: vi.fn(async () => ({ status: 'found', phone: '8229099100' }) as const),
      })

      const { outcome, save } = await runEnrichPhone(lookups)

      const expected = { status: 'found', phone: '8229099100', provider: 'orionConnect' }
      expect(outcome).toEqual(expected)
      expect(lookups.lookupPhoneWithOrionConnect).toHaveBeenCalledWith({
        fullName: 'Ada Lovelace',
        email: 'ada@acme.com',
        jobTitle: 'CTO',
      })
      expect(lookups.lookupPhoneWithAstraDialer).not.toHaveBeenCalled()
      expect(lookups.lookupPhoneWithNimbusLookup).not.toHaveBeenCalled()
      expect(save).toHaveBeenCalledTimes(1)
      expect(save).toHaveBeenCalledWith(input.leadId, expected)
    },
    TEST_TIMEOUT_MS
  )

  it(
    'goes to Astra when Orion has no phone, and saves found with astraDialer',
    async () => {
      const lookups = makeLookupMocks({
        lookupPhoneWithAstraDialer: vi.fn(async () => ({ status: 'found', phone: '2502843895' }) as const),
      })

      const { outcome, save } = await runEnrichPhone(lookups)

      expect(outcome).toEqual({ status: 'found', phone: '2502843895', provider: 'astraDialer' })
      expect(lookups.lookupPhoneWithNimbusLookup).not.toHaveBeenCalled()
      expect(save).toHaveBeenCalledTimes(1)
    },
    TEST_TIMEOUT_MS
  )

  it(
    'keeps the Nimbus country code',
    async () => {
      const lookups = makeLookupMocks({
        lookupPhoneWithNimbusLookup: vi.fn(
          async () => ({ status: 'found', phone: '8173646528', countryCode: 'ES' }) as const
        ),
      })

      const { outcome } = await runEnrichPhone(lookups)

      expect(outcome).toEqual({
        status: 'found',
        phone: '8173646528',
        countryCode: 'ES',
        provider: 'nimbusLookup',
      })
    },
    TEST_TIMEOUT_MS
  )

  it(
    'saves not_found when each provider has no phone or skips',
    async () => {
      const lookups = makeLookupMocks({
        lookupPhoneWithOrionConnect: vi.fn(async () => ({ status: 'skipped', reason: 'free-mail' }) as const),
      })

      const { outcome, save } = await runEnrichPhone(lookups)

      expect(outcome).toEqual({ status: 'not_found' })
      expect(lookups.lookupPhoneWithNimbusLookup).toHaveBeenCalledTimes(1)
      expect(save).toHaveBeenCalledTimes(1)
      expect(save).toHaveBeenCalledWith(input.leadId, { status: 'not_found' })
    },
    TEST_TIMEOUT_MS
  )

  it(
    'retries Orion three times, then goes to Astra and saves found',
    async () => {
      const lookups = makeLookupMocks({
        lookupPhoneWithOrionConnect: vi.fn(alwaysFails),
        lookupPhoneWithAstraDialer: vi.fn(async () => ({ status: 'found', phone: '2502843895' }) as const),
      })

      const { outcome, save } = await runEnrichPhone(lookups)

      expect(lookups.lookupPhoneWithOrionConnect).toHaveBeenCalledTimes(3)
      expect(outcome).toEqual({ status: 'found', phone: '2502843895', provider: 'astraDialer' })
      expect(save).toHaveBeenCalledTimes(1)
    },
    TEST_TIMEOUT_MS
  )

  it(
    'does not retry a non-retryable failure, and goes to the next provider',
    async () => {
      const lookups = makeLookupMocks({
        lookupPhoneWithOrionConnect: vi.fn(async () => {
          throw ApplicationFailure.nonRetryable(
            'Orion Connect answered with HTTP 401',
            'ProviderRejectedRequest'
          )
        }),
      })

      const { outcome } = await runEnrichPhone(lookups)

      expect(lookups.lookupPhoneWithOrionConnect).toHaveBeenCalledTimes(1)
      expect(lookups.lookupPhoneWithAstraDialer).toHaveBeenCalledTimes(1)
      expect(outcome).toEqual({ status: 'failed' })
    },
    TEST_TIMEOUT_MS
  )

  it(
    'saves failed when all three providers fail',
    async () => {
      const lookups = makeLookupMocks({
        lookupPhoneWithOrionConnect: vi.fn(alwaysFails),
        lookupPhoneWithAstraDialer: vi.fn(alwaysFails),
        lookupPhoneWithNimbusLookup: vi.fn(alwaysFails),
      })

      const { outcome, save } = await runEnrichPhone(lookups)

      expect(outcome).toEqual({ status: 'failed' })
      expect(lookups.lookupPhoneWithNimbusLookup).toHaveBeenCalledTimes(3)
      expect(save).toHaveBeenCalledTimes(1)
      expect(save).toHaveBeenCalledWith(input.leadId, { status: 'failed' })
    },
    TEST_TIMEOUT_MS
  )
})
