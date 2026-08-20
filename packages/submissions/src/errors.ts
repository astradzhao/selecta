export class SubmissionsError extends Error {
  readonly code: "invalid_input" | "not_found";

  constructor(code: "invalid_input" | "not_found", message: string) {
    super(message);
    this.name = "SubmissionsError";
    this.code = code;
  }
}

export function isSubmissionsError(error: unknown): error is SubmissionsError {
  return error instanceof SubmissionsError;
}
