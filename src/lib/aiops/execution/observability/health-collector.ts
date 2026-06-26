// Execution Observability (Milestone 5.0, deliverable #5) — passive health.
//
// Observes execution outcomes and maintains a per-provider ProviderHealth view:
// latency, timeouts, provider-unavailable, authentication failures, rate limits.
// It is PASSIVE — nothing here influences routing, and there are NO circuit
// breakers, failover, or retries. It only updates the health map that future
// governance/observability surfaces will read. Observation only.

import type {
  ProviderHealth,
  ProviderHealthStatus,
} from "@/lib/aiops/providers/provider-registry-types";
import type { InferenceExecutionContext, InferenceExecutionResult } from "../execution-types";
import type { ExecutionError, ExecutionErrorKind } from "../execution-errors";
import { observedNowIso } from "./observability-clock";
import {
  guard,
  MIDDLEWARE_PRIORITY,
  type ExecutionMiddleware,
} from "./execution-middleware";

/** Rolling per-provider observation state. */
interface ProviderStat {
  successes: number;
  failures: number;
  /** Recent latency samples (bounded), for a deterministic p50. */
  latencies: number[];
  byErrorKind: Map<ExecutionErrorKind, number>;
  lastErrorKind: ExecutionErrorKind | null;
  checkedAt: string | null;
}

const SAMPLE_LIMIT = 50;

/** Median of a numeric sample (lower-middle for even counts). Deterministic. */
function p50(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor((sorted.length - 1) / 2);
  return sorted[mid] ?? null;
}

/** Map the most recent outcome onto a health status. Auth/unavailable failures
 *  are treated as "unavailable" (the provider cannot serve), transient failures
 *  (timeout/rate-limit) as "degraded", and a clean success as "healthy". */
function deriveStatus(stat: ProviderStat, lastWasSuccess: boolean): ProviderHealthStatus {
  if (lastWasSuccess) return "healthy";
  switch (stat.lastErrorKind) {
    case "authentication":
    case "provider_unavailable":
      return "unavailable";
    case "timeout":
    case "rate_limit":
      return "degraded";
    default:
      return "degraded";
  }
}

export class PassiveHealthCollector implements ExecutionMiddleware {
  readonly name = "health";
  readonly priority = MIDDLEWARE_PRIORITY.health;

  private readonly stats = new Map<string, ProviderStat>();

  private stat(provider: string): ProviderStat {
    let s = this.stats.get(provider);
    if (!s) {
      s = {
        successes: 0,
        failures: 0,
        latencies: [],
        byErrorKind: new Map(),
        lastErrorKind: null,
        checkedAt: null,
      };
      this.stats.set(provider, s);
    }
    return s;
  }

  /** Current health for one provider, or an unknown-status default. */
  health(provider: string): ProviderHealth {
    const s = this.stats.get(provider);
    if (!s) {
      return { provider, status: "unknown", checkedAt: null, latencyMsP50: null, detail: null };
    }
    // `lastErrorKind === null` exactly when the most recent terminal outcome was
    // a success (afterExecute clears it; executionFailed sets it).
    const lastWasSuccess = s.lastErrorKind === null;
    const status = deriveStatus(s, lastWasSuccess);
    const detail = lastWasSuccess
      ? `${s.successes} ok / ${s.failures} failed`
      : `last error: ${s.lastErrorKind}`;
    return {
      provider,
      status,
      checkedAt: s.checkedAt,
      latencyMsP50: p50(s.latencies),
      detail,
    };
  }

  /** Health for every observed provider. */
  all(): ProviderHealth[] {
    return [...this.stats.keys()].map((p) => this.health(p));
  }

  reset(): void {
    this.stats.clear();
  }

  afterExecute(ctx: InferenceExecutionContext, result: InferenceExecutionResult): void {
    guard(() => {
      const s = this.stat(ctx.provider);
      s.successes += 1;
      s.lastErrorKind = null;
      s.checkedAt = observedNowIso();
      s.latencies.push(result.latency);
      if (s.latencies.length > SAMPLE_LIMIT) s.latencies.shift();
    });
  }

  executionFailed(ctx: InferenceExecutionContext, error: ExecutionError): void {
    guard(() => {
      const s = this.stat(ctx.provider);
      s.failures += 1;
      s.lastErrorKind = error.kind;
      s.byErrorKind.set(error.kind, (s.byErrorKind.get(error.kind) ?? 0) + 1);
      s.checkedAt = observedNowIso();
    });
  }
}
