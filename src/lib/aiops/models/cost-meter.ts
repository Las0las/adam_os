// Per-run model cost meter (§30, runtime safety). Accumulates the USD cost of
// model calls within an async scope so the agent runtime can enforce a real
// dollar budget. Every getModelProvider().complete() records its cost here; when
// no meter is active (e.g. a standalone function call) recording is a no-op.
//
// Pinned to globalThis: module resolution can evaluate this file more than once
// (the `@/` alias vs relative imports, Next.js bundling), and two
// AsyncLocalStorage instances would let cost recorded by the model layer be
// invisible to the agent runtime. A process-wide singleton guarantees one store.

import { AsyncLocalStorage } from "node:async_hooks";

export interface CostMeter {
  totalCostUsd: number;
  calls: number;
}

const globalRef = globalThis as unknown as {
  __lawrenceCostMeter?: AsyncLocalStorage<CostMeter>;
};
const storage: AsyncLocalStorage<CostMeter> =
  globalRef.__lawrenceCostMeter ??
  (globalRef.__lawrenceCostMeter = new AsyncLocalStorage<CostMeter>());

/** Bind a fresh meter for the remainder of the current async context (request path). */
export function enterCostMeter(): CostMeter {
  const meter: CostMeter = { totalCostUsd: 0, calls: 0 };
  storage.enterWith(meter);
  return meter;
}

/** Run `fn` with a fresh, isolated meter (auto-cleared on return). */
export function runWithCostMeter<R>(fn: (meter: CostMeter) => R): R {
  const meter: CostMeter = { totalCostUsd: 0, calls: 0 };
  return storage.run(meter, () => fn(meter));
}

/** Record the cost of one model call into the active meter (no-op if none). */
export function recordModelCost(costUsd: number): void {
  const meter = storage.getStore();
  if (!meter) return;
  if (Number.isFinite(costUsd) && costUsd > 0) meter.totalCostUsd += costUsd;
  meter.calls += 1;
}

/** The meter bound to the current async context, or null when none is set. */
export function currentCostMeter(): CostMeter | null {
  return storage.getStore() ?? null;
}
