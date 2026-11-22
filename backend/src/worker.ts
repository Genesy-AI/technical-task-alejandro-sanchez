import path from 'path'
import { PrismaClient } from '@prisma/client'
import { NativeConnection, Worker } from '@temporalio/worker'
import { loadPhoneProvidersConfig, PhoneProvidersConfig } from './phoneProviders/config'
import { PHONE_PROVIDER_CHAIN, PhoneProviderStep } from './phoneProviders/registry'
import {
  createPhoneEnrichmentActivities,
  createPhoneLookupActivity,
  verifyEmail,
} from './workflows/activities'
import { TEMPORAL_ADDRESS, TEMPORAL_NAMESPACE, TEMPORAL_TASK_QUEUE } from './temporalClient'

// Runs the workflows, email verification, and the database writes of phone enrichment.
function createMainWorker(connection: NativeConnection, prisma: PrismaClient): Promise<Worker> {
  return Worker.create({
    connection,
    namespace: TEMPORAL_NAMESPACE,
    taskQueue: TEMPORAL_TASK_QUEUE,
    // The bundler accepts a directory. Vitest cannot `require.resolve` a .ts file.
    workflowsPath: path.join(__dirname, 'workflows'),
    activities: { verifyEmail, ...createPhoneEnrichmentActivities(prisma) },
  })
}

// Runs the lookup activity of one provider on its own queue. The Temporal server applies the
// rate limit to the queue, so it holds for all workers.
function createProviderWorker(
  connection: NativeConnection,
  step: PhoneProviderStep,
  config: PhoneProvidersConfig
): Promise<Worker> {
  const settings = config[step.provider.id]
  const rateLimit = settings.maxRequestsPerSecond
  return Worker.create({
    connection,
    namespace: TEMPORAL_NAMESPACE,
    taskQueue: step.taskQueue,
    activities: { [step.activityName]: createPhoneLookupActivity(step, settings) },
    ...(rateLimit === undefined ? {} : { maxTaskQueueActivitiesPerSecond: rateLimit }),
  })
}

/**
 * Starts the Temporal workers: one on `myQueue` for the workflows and the database activities,
 * and one for each phone provider queue. All workers share one connection.
 *
 * The phone provider config is checked first. A missing key stops the start before any worker polls.
 *
 * @param prisma - The Prisma client for the activities that write leads.
 * @returns A promise that resolves when all workers stop.
 * @throws {Error} When the phone provider config is not complete, or a worker cannot start or fails.
 * @example
 * runTemporalWorker(prisma).catch((error) => { console.error(error); process.exit(1) })
 */
export async function runTemporalWorker(prisma: PrismaClient): Promise<void> {
  const config = loadPhoneProvidersConfig()
  const connection = await NativeConnection.connect({
    address: TEMPORAL_ADDRESS,
  })
  try {
    const workers = await Promise.all([
      createMainWorker(connection, prisma),
      ...PHONE_PROVIDER_CHAIN.map((step) => createProviderWorker(connection, step, config)),
    ])
    await Promise.all(workers.map((worker) => worker.run()))
  } finally {
    await connection.close()
  }
}
