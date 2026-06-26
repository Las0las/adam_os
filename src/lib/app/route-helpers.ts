// Thin route-handler helpers. Routes resolve context, validate, call a service,
// and return { ok, data } / { ok:false, error }. No business logic here.

import { NextResponse } from "next/server";

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
