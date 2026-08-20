import { ApiClientError } from "./client";

export const DB_NOT_CONFIGURED_MESSAGE =
  "The local submissions database isn’t running. Start the full stack with `pnpm dev`.";

export const PROVIDER_NOT_CONFIGURED_MESSAGE =
  "Catalog search isn’t configured. Use manual entry, or set Spotify credentials on the API.";

export function describeApiError(
  err: unknown,
  { resource, fallback }: { resource?: string; fallback?: string } = {},
): string {
  if (err instanceof ApiClientError) {
    if (err.code === "db_not_configured") return DB_NOT_CONFIGURED_MESSAGE;
    if (err.code === "provider_not_configured") return PROVIDER_NOT_CONFIGURED_MESSAGE;
    return err.message;
  }
  if (fallback) return fallback;
  if (resource) return `Failed to load ${resource}. Is the API running?`;
  return "Something went wrong. Is the API running?";
}
