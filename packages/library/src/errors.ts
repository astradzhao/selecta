export class MusicWriteError extends Error {
  readonly code: "invalid_input" | "not_found" | "conflict";
  readonly details?: Record<string, unknown>;

  constructor(
    code: "invalid_input" | "not_found" | "conflict",
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "MusicWriteError";
    this.code = code;
    this.details = details;
  }
}

export function isMusicWriteError(error: unknown): error is MusicWriteError {
  return error instanceof MusicWriteError;
}

/**
 * HTTP status for sequence (blocks) routes (DJ-112).
 * Track/transition routes still map `invalid_input` to 400.
 */
export function sequenceMusicWriteStatus(code: MusicWriteError["code"]): 404 | 409 | 422 {
  switch (code) {
    case "not_found":
      return 404;
    case "conflict":
      return 409;
    case "invalid_input":
      return 422;
  }
}
