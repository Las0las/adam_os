// Normalized execution errors (Milestone 4.0, deliverable #6). The pipeline maps
// every transport/provider failure onto one of these stable kinds so NO raw
// transport exception leaks to callers. Future layers (telemetry, audit) read
// `kind` rather than parsing vendor messages.

export type ExecutionErrorKind =
  | "authentication"
  | "timeout"
  | "rate_limit"
  | "provider_unavailable"
  | "cancelled"
  | "execution_failed";

export class ExecutionError extends Error {
  constructor(
    readonly kind: ExecutionErrorKind,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ExecutionError";
  }
}

export class AuthenticationError extends ExecutionError {
  constructor(message: string, cause?: unknown) {
    super("authentication", message, cause);
    this.name = "AuthenticationError";
  }
}
export class TimeoutError extends ExecutionError {
  constructor(message: string, cause?: unknown) {
    super("timeout", message, cause);
    this.name = "TimeoutError";
  }
}
export class RateLimitError extends ExecutionError {
  constructor(message: string, cause?: unknown) {
    super("rate_limit", message, cause);
    this.name = "RateLimitError";
  }
}
export class ProviderUnavailableError extends ExecutionError {
  constructor(message: string, cause?: unknown) {
    super("provider_unavailable", message, cause);
    this.name = "ProviderUnavailableError";
  }
}
export class ExecutionCancelledError extends ExecutionError {
  constructor(message: string, cause?: unknown) {
    super("cancelled", message, cause);
    this.name = "ExecutionCancelledError";
  }
}
export class ExecutionFailedError extends ExecutionError {
  constructor(message: string, cause?: unknown) {
    super("execution_failed", message, cause);
    this.name = "ExecutionFailedError";
  }
}

/** Serializable projection stored on InferenceExecutionResult.error. */
export interface NormalizedExecutionError {
  kind: ExecutionErrorKind;
  name: string;
  message: string;
}

/** Map an arbitrary thrown value onto a normalized ExecutionError. Already-
 *  normalized errors pass through. Classification is by message/name signature
 *  (no provider-specific coupling). */
export function normalizeError(err: unknown): ExecutionError {
  if (err instanceof ExecutionError) return err;
  const message = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : "";

  if (name === "AbortError" || /\bcancel(l?ed)?\b/i.test(message)) {
    return new ExecutionCancelledError(message, err);
  }
  if (/(401|403|unauthorized|forbidden|api[\s_-]?key|is not set|token)/i.test(message)) {
    return new AuthenticationError(message, err);
  }
  if (/(429|rate[\s_-]?limit|quota|too many requests)/i.test(message)) {
    return new RateLimitError(message, err);
  }
  if (/(timeout|timed out|ETIMEDOUT|deadline)/i.test(message)) {
    return new TimeoutError(message, err);
  }
  if (/(unavailable|503|502|504|ENOTFOUND|ECONNREFUSED|ECONNRESET|network|fetch failed)/i.test(message)) {
    return new ProviderUnavailableError(message, err);
  }
  return new ExecutionFailedError(message, err);
}

export function toNormalized(err: ExecutionError): NormalizedExecutionError {
  return { kind: err.kind, name: err.name, message: err.message };
}
