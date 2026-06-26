// Thin route-handler helpers. Routes resolve context, validate, call a service,
// and return { ok, data } / { ok:false, error }. No business logic here.

import { NextResponse } from "next/server";
import type { ZodType } from "zod";

/** Thrown by parseBody when the request body fails schema validation. `run()`
 *  maps it (like any throw) to a 400 with the validation message. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function ok(data: unknown): NextResponse {
  return NextResponse.json({ ok: true, data });
}

export function fail(error: string, status = 400): NextResponse {
  return NextResponse.json({ ok: false, error }, { status });
}

/** Run a service call and map success/throw to the standard envelope. */
export async function run(fn: () => Promise<unknown>): Promise<NextResponse> {
  try {
    return ok(await fn());
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
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
