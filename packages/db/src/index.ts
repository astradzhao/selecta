/** Postgres schema + migrate tooling (client/membership land in DJ-22). */
export function getDbStatus() {
  return { configured: false as const, store: "postgres" as const };
}

export * from "./schema";
