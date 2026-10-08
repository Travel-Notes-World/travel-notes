import { sql } from '@payloadcms/db-postgres'
import type { Payload, PayloadRequest } from 'payload'
import { commitTransaction, createLocalReq, getPayload, initTransaction, killTransaction } from 'payload'

import config from '../../payload.config'

export { sql }

/** The CMS client. Service code is trusted server code: it authorises first, then writes. */
export const cms = (): Promise<Payload> => getPayload({ config })

export type Tx = {
  payload: Payload
  /** Pass this to every Local API call so the call joins the transaction. */
  req: PayloadRequest
  /** Run something only after the transaction has committed, for example an email delivery attempt. */
  afterCommit: (fn: () => Promise<unknown> | unknown) => void
}

/**
 * Run several writes as one database transaction: all of them happen or none do.
 * Work queued with `afterCommit` runs only once the data is safely stored, and a failure there
 * never undoes the committed change (it is logged and left for the retry job).
 */
export async function inTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const payload = await cms()
  const req = await createLocalReq({}, payload)
  const after: (() => Promise<unknown> | unknown)[] = []
  await initTransaction(req)
  let result: T
  try {
    result = await fn({ payload, req, afterCommit: (cb) => after.push(cb) })
    await commitTransaction(req)
  } catch (error) {
    await killTransaction(req)
    throw error
  }
  for (const cb of after) {
    try {
      await cb()
    } catch (error) {
      payload.logger.error({ err: error }, '[community] after-commit step failed')
    }
  }
  return result
}

type Executor = { execute: (query: ReturnType<typeof sql>) => Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }> }

/** The raw SQL executor: inside the transaction when `req` has one, otherwise the plain connection. */
export async function executor(payload: Payload, req?: PayloadRequest): Promise<Executor> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the adapter's session map is not in the public types
  const db = payload.db as any
  const id = req?.transactionID ? await req.transactionID : undefined
  return (id !== undefined && db.sessions?.[id]?.db) || db.drizzle
}

/** Run a parameterised SQL statement. Values in the template are always sent as parameters. */
export async function run(payload: Payload, query: ReturnType<typeof sql>, req?: PayloadRequest) {
  const exec = await executor(payload, req)
  return exec.execute(query)
}

export const relId = (value: unknown): string | null => {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object' && 'id' in (value as object)) return String((value as { id: unknown }).id)
  return null
}

export const relIds = (value: unknown): string[] => (Array.isArray(value) ? value.map(relId).filter((v): v is string => Boolean(v)) : [])
