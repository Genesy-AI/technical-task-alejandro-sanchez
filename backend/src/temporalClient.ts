import { Client, Connection } from '@temporalio/client'

/** The address of the Temporal server. The worker and all clients use it. */
export const TEMPORAL_ADDRESS = 'localhost:7233'
/** The Temporal namespace. The worker and all clients use it. */
export const TEMPORAL_NAMESPACE = 'default'
/** The task queue that the worker polls. Clients must start workflows on it. */
export const TEMPORAL_TASK_QUEUE = 'myQueue'

interface SharedClient {
  client: Client
  connection: Connection
}

// One promise for all callers, so that concurrent first calls share one connection.
let sharedClient: Promise<SharedClient> | undefined

async function connectSharedClient(): Promise<SharedClient> {
  const connection = await Connection.connect({ address: TEMPORAL_ADDRESS })
  const client = new Client({ connection, namespace: TEMPORAL_NAMESPACE })
  return { client, connection }
}

/**
 * Gets the shared Temporal client. The first call opens the connection. Later calls reuse it.
 *
 * A failed connection attempt is not cached. The next call tries to connect again.
 *
 * @returns The shared Temporal client.
 * @throws When the client cannot connect to the Temporal server.
 * @example
 * const client = await getTemporalClient()
 * await client.workflow.start(verifyEmailWorkflow, { taskQueue: TEMPORAL_TASK_QUEUE, workflowId, args })
 */
export async function getTemporalClient(): Promise<Client> {
  if (!sharedClient) {
    sharedClient = connectSharedClient().catch((error: unknown) => {
      sharedClient = undefined
      throw error
    })
  }
  const { client } = await sharedClient
  return client
}

/**
 * Closes the shared Temporal connection. The next call to `getTemporalClient` opens a new one.
 *
 * @returns A promise that resolves when the connection is closed.
 * @example
 * process.on('SIGTERM', () => void closeTemporalClient())
 */
export async function closeTemporalClient(): Promise<void> {
  if (!sharedClient) {
    return
  }
  const pendingClient = sharedClient
  sharedClient = undefined
  const { connection } = await pendingClient.catch(() => ({ connection: undefined }))
  await connection?.close()
}
