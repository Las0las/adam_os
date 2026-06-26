// Execution hook registry (Milestone 4.0, deliverable #3). A process-wide,
// ordered list of extension points. No hooks are registered by default — future
// capabilities (telemetry, audit, prompt firewall, evaluation, caching) attach
// here without modifying providers or routing.
//
// The pipeline reads from this registry by default, but callers may pass an
// explicit hook list for isolation (used by tests).

import type { ExecutionHook } from "./execution-types";

const hooks: ExecutionHook[] = [];

export function registerExecutionHook(hook: ExecutionHook): void {
  hooks.push(hook);
}

/** Hooks in registration order (a copy — the registry is not mutated by callers). */
export function listExecutionHooks(): ExecutionHook[] {
  return [...hooks];
}

/** Remove all hooks. Intended for test isolation. */
export function clearExecutionHooks(): void {
  hooks.length = 0;
}
