export class NotesError extends Error {
  readonly code: "invalid_input" | "not_found";

  constructor(code: "invalid_input" | "not_found", message: string) {
    super(message);
    this.name = "NotesError";
    this.code = code;
  }
}

export function isNotesError(error: unknown): error is NotesError {
  return error instanceof NotesError;
}
