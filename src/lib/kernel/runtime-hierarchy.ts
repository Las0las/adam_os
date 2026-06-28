// L0 kernel — the runtime dependency hierarchy.
//
// The architecture is acyclic by construction: a lower layer may never depend
// on a higher one. The Constitution Runtime (L0) depends on nothing; surfaces
// (top) may depend on everything below. This module declares the order and a
// guard so violations fail loudly instead of silently creating cycles.
//
//   L0 Constitution → L1 Identity → L2 Enterprise → L3 Projection →
//   L4 Workflow → L5 Intelligence → L6 Host → Surface

export const RUNTIME_LAYERS = [
  "constitution", // L0 — issues ExecutionAuthority; depends on nothing
  "identity", // L1
  "enterprise", // L2
  "projection", // L3
  "workflow", // L4
  "intelligence", // L5 — AI requests authority; never executes directly
  "host", // L6
  "surface", // top
] as const;

export type RuntimeLayer = (typeof RUNTIME_LAYERS)[number];

/** Numeric rank; lower = closer to the kernel. */
export function layerRank(layer: RuntimeLayer): number {
  return RUNTIME_LAYERS.indexOf(layer);
}

/** True when `from` is permitted to depend on `to` (only downward/self). */
export function canDepend(from: RuntimeLayer, to: RuntimeLayer): boolean {
  return layerRank(from) >= layerRank(to);
}

export class RuntimeHierarchyError extends Error {
  constructor(from: RuntimeLayer, to: RuntimeLayer) {
    super(
      `Runtime hierarchy violation: ${from} (L${layerRank(from)}) may not depend on ${to} (L${layerRank(to)}). Lower layers cannot reference higher layers.`,
    );
    this.name = "RuntimeHierarchyError";
  }
}

/** Assert an allowed dependency edge; throws on an upward reference. */
export function assertCanDepend(from: RuntimeLayer, to: RuntimeLayer): void {
  if (!canDepend(from, to)) throw new RuntimeHierarchyError(from, to);
}
