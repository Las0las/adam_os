// Thin route-handler helpers. Routes resolve context, validate, call a service,
// and return { ok, data } / { ok:false, error }. No business logic here.

import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { captureException } from "@/lib/observability/telemetry";
import { resolveError, ValidationError } from "./errors";

// Re-exported so existing routes can keep importing it from here.
export { ValidationError };

export function ok(data: unknown): NextResponse {
  return NextResponse.json({ ok: true, data });
}

export function fail(error: string, status = 400): NextResponse {
  return NextResponse.json({ ok: false, error }, { status });
}

/**
 * Map a thrown value to a response via the taxonomy: typed/permission errors get
 * their proper status + message; unexpected errors are redacted to a generic 500
 * with a correlation id, and the real detail is exported server-side (never to
 * the client). Only 5xx are sent to the telemetry sink (client 4xx are not
 * errors). Used by run() and by raw-response routes in their catch blocks.
 */
export function errorResponse(err: unknown): NextResponse {
  const resolved = resolveError(err);
  if (resolved.status >= 500) {
    void captureException(err, {
      component: "api_route",
      extra: { correlationId: resolved.body.correlationId },
    });
  }
  return NextResponse.json(resolved.body, { status: resolved.status });
}

/** Run a service call and map success/throw to the standard envelope. */
export async function run(fn: () => Promise<unknown>): Promise<NextResponse> {
  try {
    return ok(await fn());
  } catch (err) {
    return errorResponse(err);
  }
}

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  return (await request.json().catch(() => ({}))) as T;
}

/**
 * Parse and validate a JSON request body against a Zod schema. Returns typed,
 * validated data, or throws ValidationError with a field-level message. Call it
 * inside a `run(async () => { const body = await parseBody(...); ... })` block so
 * a validation failure becomes a 400 via the standard envelope; raw-response
 * routes catch it and return `fail(message)`.
 */
export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const raw = await request.json().catch(() => undefined);
  const result = schema.safeParse(raw);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.join(".") || "(body)"}: ${i.message}`)
      .join("; ");
    throw new ValidationError(`invalid request body: ${detail}`);
  }
  return result.data;
}
