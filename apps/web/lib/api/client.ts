/** Shared browser client for @selecta/api via same-origin `/backend` rewrite. */

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

type ApiErrorBody = {
  ok?: boolean;
  error?: string;
  message?: string;
};

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/backend${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const errorBody = (body ?? {}) as ApiErrorBody;
    throw new ApiClientError(
      response.status,
      errorBody.error ?? "request_failed",
      errorBody.message ?? `Request failed (${response.status}).`,
    );
  }

  return body as T;
}
