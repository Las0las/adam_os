// Execution hook registry (Milestone 4.0, extended in Milestone 5.0). A
// process-wide registry of execution extension points. Observability middleware
// (telemetry, audit, health) registers here; the pipeline reads it by default.
//
// Milestone 5.0 makes the registry PRIORITY ORDERED: hooks run in ascending
// `priority` (default 0), with registration order as a stable tie-break. Hooks
// of equal priority therefore keep their legacy registration-order behavior, so
// existing callers are unaffected. The pipeline never hard-codes a hook; it
// always resolves the ordered chain from here (or from an explicit list passed
// for test isolation).

import type { ExecutionHook } from "./execution-types";

interface RegisteredHook {
  hook: ExecutionHook;
  seq: number;
}

const registered: RegisteredHook[] = [];
let seqCounter = 0;

function priorityOf(hook: ExecutionHook): number {
  return hook.priority ?? 0;
}

export function registerExecutionHook(hook: ExecutionHook): void {
  registered.push({ hook, seq: seqCounter++ });
}

/** Hooks in execution order: priority ascending, registration order as the
 *  stable tie-break. Returns a fresh array — the registry is not mutated. */
export function listExecutionHooks(): ExecutionHook[] {
  return [...registered]
    .sort((a, b) => priorityOf(a.hook) - priorityOf(b.hook) || a.seq - b.seq)
    .map((r) => r.hook);
}

/** Remove all hooks. Intended for test isolation. */
export function clearExecutionHooks(): void {
  registered.length = 0;
  seqCounter = 0;
}
