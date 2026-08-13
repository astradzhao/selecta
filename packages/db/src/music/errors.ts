export class MusicWriteError extends Error {
  readonly code: "invalid_input" | "not_found" | "conflict";

  constructor(code: "invalid_input" | "not_found" | "conflict", message: string) {
    super(message);
    this.name = "MusicWriteError";
    this.code = code;
  }
}

export function isMusicWriteError(error: unknown): error is MusicWriteError {
  return error instanceof MusicWriteError;
}
