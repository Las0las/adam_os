// Execution Observability (Milestone 5.0, deliverable #5; reworked in 5.5).
//
// Observes execution outcomes and maintains a per-provider ProviderHealth view:
// latency, timeouts, provider-unavailable, authentication failures, rate limits.
// Since Milestone 5.5 it is a BUS SUBSCRIBER, driven by canonical events. It is
// PASSIVE — nothing here influences routing, and there are NO circuit breakers,
// failover, or retries. Observation only.

import type {
  ProviderHealth,
  ProviderHealthStatus,
} from "@/lib/aiops/providers/provider-registry-types";
import type { ExecutionErrorKind } from "../execution-errors";
import { isExecutionEvent } from "./execution-events";
import type { BusEvent, ExecutionEventSubscriber } from "./execution-event-bus";
import { observedNowIso } from "./observability-clock";

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

/** Failure kinds that reflect on PROVIDER health. Security/validation rejections
 *  happen before or after the provider call and are not provider faults, so they
 *  never degrade provider health. */
const PROVIDER_FAULT_KINDS: ReadonlySet<ExecutionErrorKind> = new Set([
  "authentication",
  "timeout",
  "rate_limit",
  "provider_unavailable",
]);

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
function deriveStatus(lastErrorKind: ExecutionErrorKind | null, lastWasSuccess: boolean): ProviderHealthStatus {
  if (lastWasSuccess) return "healthy";
  switch (lastErrorKind) {
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

export class PassiveHealthCollector implements ExecutionEventSubscriber {
  readonly name = "health";

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

  onEvent(event: BusEvent): void {
    if (!isExecutionEvent(event)) return;
    if (event.type === "execution.completed") {
      const s = this.stat(event.provider);
      s.successes += 1;
      s.lastErrorKind = null;
      s.checkedAt = observedNowIso();
      s.latencies.push(event.latency);
      if (s.latencies.length > SAMPLE_LIMIT) s.latencies.shift();
    } else if (event.type === "execution.failed") {
      // Only genuine provider faults reflect on provider health. A security or
      // validation rejection is not the provider's fault — ignore it here.
      if (!PROVIDER_FAULT_KINDS.has(event.error.kind)) return;
      const s = this.stat(event.provider);
      s.failures += 1;
      s.lastErrorKind = event.error.kind;
      s.byErrorKind.set(event.error.kind, (s.byErrorKind.get(event.error.kind) ?? 0) + 1);
      s.checkedAt = observedNowIso();
    }
  }

  /** Current health for one provider, or an unknown-status default. */
  health(provider: string): ProviderHealth {
    const s = this.stats.get(provider);
    if (!s) {
      return { provider, status: "unknown", checkedAt: null, latencyMsP50: null, detail: null };
    }
    // `lastErrorKind === null` exactly when the most recent terminal outcome was
    // a success (a completion clears it; a failure sets it).
    const lastWasSuccess = s.lastErrorKind === null;
    const status = deriveStatus(s.lastErrorKind, lastWasSuccess);
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
}
