import path from 'path'
import { Client } from '@temporalio/client'
import { TestWorkflowEnvironment } from '@temporalio/testing'
import { DefaultLogger, Runtime, Worker } from '@temporalio/worker'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  EmailVerificationDependencies,
  LeadToVerify,
  runEmailVerificationWorkflow,
  verifyLeadEmails,
} from './emailVerification'
import { TEMPORAL_TASK_QUEUE } from './temporalClient'

// Vitest cannot `require.resolve` a .ts file.
const WORKFLOWS_PATH = path.join(__dirname, 'workflows', 'index.ts')
// The first run downloads the Temporal test server binary.
const SETUP_TIMEOUT_MS = 120_000
const TEST_TIMEOUT_MS = 30_000
// Enough real time for the second start request to reach the server while the first run is open.
const SECOND_REQUEST_GRACE_MS = 500
const WORKFLOW_TIMEOUT_SECONDS = 30

const validLead: LeadToVerify = { id: 1, firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' }
const invalidLead: LeadToVerify = { id: 2, firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com' }
const slowLead: LeadToVerify = {
  id: 3,
  firstName: 'Jane',
  lastName: 'Smith',
  email: 'jane.smith@example.com',
}

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

function makeDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function makeDependencies(
  runVerification: EmailVerificationDependencies['runVerification']
): EmailVerificationDependencies {
  return { runVerification: vi.fn(runVerification), saveVerification: vi.fn(async () => undefined) }
}

describe('verifyLeadEmails', () => {
  it('reports valid, invalid, and failed leads, and saves only the leads with a result', async () => {
    const dependencies = makeDependencies(async (lead) => {
      if (lead.id === slowLead.id) {
        throw new Error('Workflow execution failed')
      }
      return lead.id === validLead.id
    })

    const report = await verifyLeadEmails([validLead, invalidLead, slowLead], dependencies)

    expect(report).toEqual({
      success: true,
      verifiedCount: 2,
      validCount: 1,
      invalidCount: 1,
      failedCount: 1,
      results: [
        { leadId: 1, emailVerified: true },
        { leadId: 2, emailVerified: false },
      ],
      errors: [{ leadId: 3, leadName: 'Jane Smith', error: 'Workflow execution failed' }],
    })
    expect(dependencies.saveVerification).toHaveBeenCalledTimes(2)
    expect(dependencies.saveVerification).toHaveBeenCalledWith(1, true)
    expect(dependencies.saveVerification).toHaveBeenCalledWith(2, false)
  })

  it('starts all verifications before any of them ends', async () => {
    const pending = [makeDeferred<boolean>(), makeDeferred<boolean>()]
    const dependencies = makeDependencies((lead) => pending[lead.id - 1].promise)

    const report = verifyLeadEmails([validLead, invalidLead], dependencies)
    await Promise.resolve()

    expect(dependencies.runVerification).toHaveBeenCalledTimes(2)
    pending.forEach((deferred) => deferred.resolve(true))
    await expect(report).resolves.toMatchObject({ validCount: 2, failedCount: 0 })
  })

  it('counts a lead as failed when its result cannot be saved', async () => {
    const dependencies = makeDependencies(async () => true)
    vi.mocked(dependencies.saveVerification).mockRejectedValue(new Error('Database is locked'))

    const report = await verifyLeadEmails([validLead], dependencies)

    expect(report).toMatchObject({
      validCount: 0,
      failedCount: 1,
      results: [],
      errors: [{ leadId: 1, leadName: 'Ada Lovelace', error: 'Database is locked' }],
    })
  })
})

describe('runEmailVerificationWorkflow', () => {
  let testEnv: TestWorkflowEnvironment

  beforeAll(async () => {
    Runtime.install({ logger: new DefaultLogger('WARN') })
    testEnv = await TestWorkflowEnvironment.createTimeSkipping()
  }, SETUP_TIMEOUT_MS)

  afterAll(async () => {
    await testEnv?.teardown()
  })

  it(
    'joins the running workflow when the same lead is verified twice',
    async () => {
      const pendingAttempts: Array<(isValid: boolean) => void> = []
      const verifyEmail = vi.fn(() => new Promise<boolean>((resolve) => pendingAttempts.push(resolve)))
      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: TEMPORAL_TASK_QUEUE,
        workflowsPath: WORKFLOWS_PATH,
        activities: { verifyEmail },
      })

      // `testEnv.client` skips time while it waits for a result. A plain client keeps real time,
      // so the grace period does not push the first attempt past its timeout.
      const client = new Client({ connection: testEnv.connection })

      const outcomes = await worker.runUntil(async () => {
        const runs = [validLead, validLead].map((lead) => runEmailVerificationWorkflow(client, lead))
        await vi.waitFor(() => expect(pendingAttempts).toHaveLength(1))
        await new Promise((resolve) => setTimeout(resolve, SECOND_REQUEST_GRACE_MS))
        pendingAttempts.forEach((resolve) => resolve(true))
        return Promise.all(runs)
      })

      expect(outcomes).toEqual([true, true])
      expect(verifyEmail).toHaveBeenCalledTimes(1)
      const { raw } = await testEnv.client.workflow.getHandle(`verify-email-${validLead.id}`).describe()
      expect(Number(raw.executionConfig?.workflowExecutionTimeout?.seconds)).toBe(WORKFLOW_TIMEOUT_SECONDS)
    },
    TEST_TIMEOUT_MS
  )
})
