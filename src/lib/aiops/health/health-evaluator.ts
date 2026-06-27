// IOS-013 — Provider Health Manager — evaluator.
//
// Pure, deterministic derivation of a HealthStatus from observed signals and the
// PRIOR status (hysteresis: degradation thresholds drop the status; the higher
// recovery threshold is required to return to Healthy). No active probing, no
// prediction — health is derived only from observed execution outcomes.

import type { HealthPolicy, HealthStatus, ObservedCircuitState } from "./health-types";

export interface HealthSignals {
  /** Observed executions in the window. */
  total: number;
  /** Successful executions / total (0..1). */
  availability: number;
  /** Last observed circuit state. */
  circuitState: ObservedCircuitState;
}

/**
 * Derive the new status from the prior status and the observed signals.
 * Deterministic for identical (prior, signals, policy).
 */
export function evaluateHealth(prior: HealthStatus, signals: HealthSignals, policy: HealthPolicy): HealthStatus {
  // An observed-open circuit is a direct unavailability signal.
  if (signals.circuitState === "open") return "unavailable";
  // No observations yet → unknown.
  if (signals.total === 0) return "unknown";

  const a = signals.availability;
  const base: HealthStatus =
    a < policy.unavailableBelow ? "unavailable" : a < policy.degradedBelow ? "degraded" : "healthy";

  // Recovery hysteresis: a provider that was Degraded/Unavailable returns to
  // Healthy only once availability reaches the (higher) recovery threshold.
  if (base === "healthy" && (prior === "degraded" || prior === "unavailable") && a < policy.recoverAbove) {
    return "degraded";
  }
  return base;
}

/** Composite score (0..1): availability, forced to 0 when the circuit is open. */
export function computeHealthScore(availability: number, circuitState: ObservedCircuitState): number {
  if (circuitState === "open") return 0;
  return availability;
}
