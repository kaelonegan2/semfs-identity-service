export class SemfsError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

export function notFound(message: string, details?: unknown): SemfsError {
  return new SemfsError(404, "not_found", message, details);
}

export function badRequest(message: string, details?: unknown): SemfsError {
  return new SemfsError(400, "bad_request", message, details);
}

export function conflict(message: string, details?: unknown): SemfsError {
  return new SemfsError(409, "conflict", message, details);
}

export function forbidden(message: string, details?: unknown): SemfsError {
  return new SemfsError(403, "forbidden", message, details);
}
