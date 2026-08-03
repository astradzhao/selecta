/** Postgres client + membership queries (stub for M1). */
export function getDbStatus() {
  return { configured: false as const, store: "postgres" as const };
}
