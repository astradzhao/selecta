import { AsyncLocalStorage } from "node:async_hooks";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { getDb } from "./client";
import type * as schema from "./schema";

export type DbLike = NodePgDatabase<typeof schema>;

const dbTransactionStorage = new AsyncLocalStorage<DbLike>();

/** Resolve the active transaction executor, or the process-wide db client. */
export function getExecutor(): DbLike {
  return dbTransactionStorage.getStore() ?? getDb();
}

/**
 * Run `work` inside a Drizzle transaction, binding getExecutor() to that tx
 * for the async call stack (used by proposal commit so forward+:rev share one tx).
 */
export async function runInDbTransaction<T>(work: () => Promise<T>): Promise<T> {
  return getDb().transaction(async (tx) => {
    return dbTransactionStorage.run(tx as unknown as DbLike, work);
  });
}
