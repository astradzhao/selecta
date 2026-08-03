import type { CatalogProviderId } from "./types";

export type CatalogErrorCode = "not_configured" | "unavailable" | "invalid_query";

/** Typed catalog failure — map to HTTP in the API route. */
export class CatalogError extends Error {
  readonly code: CatalogErrorCode;
  readonly provider: CatalogProviderId | null;

  constructor(
    code: CatalogErrorCode,
    message: string,
    options?: { provider?: CatalogProviderId | null; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "CatalogError";
    this.code = code;
    this.provider = options?.provider ?? null;
  }
}

export function isCatalogError(error: unknown): error is CatalogError {
  return error instanceof CatalogError;
}
