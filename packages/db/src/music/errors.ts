export class MusicWriteError extends Error {
  readonly code: "invalid_input" | "not_found";

  constructor(code: "invalid_input" | "not_found", message: string) {
    super(message);
    this.name = "MusicWriteError";
    this.code = code;
  }
}

export function isMusicWriteError(error: unknown): error is MusicWriteError {
  return error instanceof MusicWriteError;
}
