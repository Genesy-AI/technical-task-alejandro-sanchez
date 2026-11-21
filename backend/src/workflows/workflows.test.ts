import { randomUUID } from 'crypto'
import path from 'path'
import { ActivityFailure, WorkflowFailedError } from '@temporalio/client'
import { TestWorkflowEnvironment } from '@temporalio/testing'
import { DefaultLogger, Runtime, Worker } from '@temporalio/worker'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { verifyEmailWorkflow } from './workflows'

const TASK_QUEUE = 'verify-email-test'
// Load the same barrel as the real worker. Vitest cannot `require.resolve` a .ts file.
const WORKFLOWS_PATH = path.join(__dirname, 'index.ts')
// The first run downloads the Temporal test server binary.
const SETUP_TIMEOUT_MS = 120_000
const TEST_TIMEOUT_MS = 60_000
// The ticket requires a verification to end in less than 15 seconds.
const MAX_WORKFLOW_DURATION_MS = 15_000
const MAX_ATTEMPTS = 3

type VerifyEmailActivity = (email: string) => Promise<boolean>

interface WorkflowRun {
  result: Promise<boolean>
  durationMs: () => Promise<number>
}

let testEnv: TestWorkflowEnvironment

beforeAll(async () => {
  // Keep test output readable. The worker logs each state change at INFO level.
  Runtime.install({ logger: new DefaultLogger('WARN') })
  testEnv = await TestWorkflowEnvironment.createTimeSkipping()
}, SETUP_TIMEOUT_MS)

afterAll(async () => {
  await testEnv?.teardown()
})

const doNothing = (): void => undefined

/**
 * Runs `verifyEmailWorkflow` on a test worker with a mocked `verifyEmail` activity.
 * `onWorkflowClosed` runs before the worker shuts down.
 */
async function runVerifyEmailWorkflow(
  verifyEmail: VerifyEmailActivity,
  onWorkflowClosed: () => void = doNothing
): Promise<WorkflowRun> {
  const worker = await Worker.create({
    connection: testEnv.nativeConnection,
    taskQueue: TASK_QUEUE,
    workflowsPath: WORKFLOWS_PATH,
    activities: { verifyEmail },
  })
  const handle = await testEnv.client.workflow.start(verifyEmailWorkflow, {
    taskQueue: TASK_QUEUE,
    workflowId: `verify-email-test-${randomUUID()}`,
    args: ['lead@example.com'],
  })
  const result = worker.runUntil(handle.result().finally(onWorkflowClosed))
  const durationMs = async (): Promise<number> => {
    const { startTime, closeTime } = await handle.describe()
    return (closeTime?.getTime() ?? Number.NaN) - startTime.getTime()
  }
  return { result, durationMs }
}

describe('verifyEmailWorkflow', () => {
  it(
    'returns true when the activity reports a valid email',
    async () => {
      const run = await runVerifyEmailWorkflow(async () => true)

      await expect(run.result).resolves.toBe(true)
    },
    TEST_TIMEOUT_MS
  )

  it(
    'returns false when the activity reports an invalid email',
    async () => {
      const run = await runVerifyEmailWorkflow(async () => false)

      await expect(run.result).resolves.toBe(false)
    },
    TEST_TIMEOUT_MS
  )

  it(
    'fails after the maximum attempts when the activity never finishes',
    async () => {
      const pendingAttempts: Array<() => void> = []
      const neverFinishes: VerifyEmailActivity = () =>
        new Promise((resolve) => pendingAttempts.push(() => resolve(true)))

      // The worker waits for running activities before it shuts down, so release the stuck attempts.
      const releaseAttempts = (): void => pendingAttempts.forEach((release) => release())

      const run = await runVerifyEmailWorkflow(neverFinishes, releaseAttempts)
      const outcome = await run.result.catch((error: unknown) => error)

      expect(outcome).toBeInstanceOf(WorkflowFailedError)
      expect((outcome as WorkflowFailedError).cause).toBeInstanceOf(ActivityFailure)
      expect(pendingAttempts).toHaveLength(MAX_ATTEMPTS)
      const durationMs = await run.durationMs()
      console.info(`Failed verification took ${durationMs} ms of workflow time`)
      expect(durationMs).toBeLessThan(MAX_WORKFLOW_DURATION_MS)
    },
    TEST_TIMEOUT_MS
  )
})
