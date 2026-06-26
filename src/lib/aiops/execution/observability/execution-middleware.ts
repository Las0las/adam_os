// Execution Observability (Milestone 5.0) — execution middleware.
//
//   Execution Pipeline → Middleware Chain → Provider Adapter → Provider SDK
//
// A middleware is a named, priority-ordered observer of the execution lifecycle.
// It is exactly an ExecutionHook with a REQUIRED priority, so the "middleware
// chain" is simply the priority-ordered hook chain the pipeline already runs.
//
// CONTRACT: middleware observes only. It must never mutate the request, mutate
// the response, or throw — a throwing observer would be caught by the pipeline
// and turned into a spurious failure, changing behavior. Every middleware here
// therefore wraps its work in `guard()` so an observer bug can never break, slow
// the success path into a failure, or alter execution.

import { registerExecutionHook, listExecutionHooks } from "../execution-hooks";
import type { ExecutionHook } from "../execution-types";

/** An observation-only execution hook with an explicit chain position. */
export interface ExecutionMiddleware extends ExecutionHook {
  /** Lower runs earlier in the chain. Required (unlike the base hook). */
  priority: number;
}

/** Run an observer body, swallowing any error so observation can never break or
 *  alter execution. Returns nothing; failures are intentionally silent (this
 *  milestone adds no logging sink — that is future work). */
export function guard(body: () => void): void {
  try {
    body();
  } catch {
    // Observation must not affect execution. Deliberately ignored.
  }
}

/** Register a middleware into the shared, priority-ordered execution chain. */
export function registerMiddleware(mw: ExecutionMiddleware): void {
  registerExecutionHook(mw);
}

/** The registered middleware, in execution (priority) order. A middleware is a
 *  hook that declares a numeric priority; plain hooks without one are not
 *  middleware and are excluded from this view. */
export function listMiddleware(): ExecutionMiddleware[] {
  return listExecutionHooks().filter(
    (h): h is ExecutionMiddleware => typeof h.priority === "number",
  );
}

/** Canonical chain positions, so the three core observers have a stable,
 *  documented order: telemetry first (it feeds metrics), then audit, then
 *  health. Future middleware (security, caching, optimization) slots around
 *  these by choosing a priority. */
export const MIDDLEWARE_PRIORITY = {
  telemetry: 10,
  audit: 20,
  health: 30,
} as const;
