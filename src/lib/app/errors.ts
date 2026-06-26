// Error taxonomy + response resolution (§API hardening). Typed errors carry an
// HTTP status, a stable machine `code`, and whether their message is safe to show
// a client (`expose`). resolveError() turns any thrown value into a redacted,
// correctly-statused response: known client errors expose their message; anything
// unexpected becomes a generic 500 with a correlation id, while the real detail is
// logged/exported server-side (see route-helpers run()). This prevents internal
// messages, stack traces, and DB errors from leaking to callers.

import { PermissionError } from "@/lib/lawrence-core/permissions/permissions";

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  /** Whether `message` is safe to return to the client. */
  readonly expose: boolean;

  constructor(message: string, opts: { status: number; code: string; expose?: boolean }) {
    super(message);
    this.name = new.target.name;
    this.status = opts.status;
    this.code = opts.code;
    this.expose = opts.expose ?? true;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, { status: 400, code: "validation_error" });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, { status: 401, code: "unauthorized" });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, { status: 403, code: "forbidden" });
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, { status: 404, code: "not_found" });
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(message, { status: 409, code: "conflict" });
  }
}

export interface ErrorBody {
  ok: false;
  error: string;
  code: string;
  correlationId?: string;
}

export interface ErrorResolution {
  status: number;
  body: ErrorBody;
  /** The real error message — for server-side logging only; never the client body when redacted. */
  internalMessage: string;
}

function correlationId(): string {
  return `err_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

/**
 * Resolve any thrown value into an HTTP status + client-safe body. Exposed app
 * errors and permission errors return their message; everything else is redacted
 * to a generic message + correlation id (the real message is exposed only in
 * non-production for developer ergonomics).
 */
export function resolveError(
  err: unknown,
  env: Record<string, string | undefined> = process.env,
): ErrorResolution {
  const internalMessage = err instanceof Error ? err.message : String(err);

  if (err instanceof AppError && err.expose) {
    return { status: err.status, body: { ok: false, error: err.message, code: err.code }, internalMessage };
  }
  // Permission guard failures (thrown by requirePermission) → 403.
  if (err instanceof PermissionError) {
    return { status: 403, body: { ok: false, error: err.message, code: "forbidden" }, internalMessage };
  }

  // Typed-but-not-exposed, or any unexpected error → redact.
  const status = err instanceof AppError ? err.status : 500;
  const code = err instanceof AppError ? err.code : "internal_error";
  const id = correlationId();
  const isProduction = env.NODE_ENV === "production";
  const error = isProduction ? "Internal server error" : internalMessage;
  return { status, body: { ok: false, error, code, correlationId: id }, internalMessage };
}
