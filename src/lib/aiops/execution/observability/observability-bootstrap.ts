// Execution Observability (Milestone 5.0) — wiring.
//
// Instantiates the process-wide observability stack and registers it as
// execution middleware so EVERY inference automatically produces telemetry,
// metrics, audit records, and provider-health observations — with no change to
// providers, routing, or applications. Idempotent: safe to call from any number
// of bootstrap paths.
//
//   telemetry (10) ──emits events──▶ metrics collector (subscriber)
//   audit      (20)
//   health     (30)
//
// The singletons live on globalThis (not module scope): Next.js can duplicate a
// module across route chunks, and execution is a process-global concern, so a
// per-module instance could split observation across two stacks.

import { registerMiddleware } from "./execution-middleware";
import { ExecutionTelemetryEngine } from "./telemetry-engine";
import { MetricsCollector } from "./metrics-collector";
import { ExecutionAuditEngine } from "./audit-engine";
import { PassiveHealthCollector } from "./health-collector";

export interface ObservabilityStack {
  telemetry: ExecutionTelemetryEngine;
  metrics: MetricsCollector;
  audit: ExecutionAuditEngine;
  health: PassiveHealthCollector;
  /** True once the middleware has been registered into the execution chain. */
  installed: boolean;
}

const globalRef = globalThis as unknown as { __lawrenceObservability?: ObservabilityStack };

function build(): ObservabilityStack {
  const telemetry = new ExecutionTelemetryEngine();
  const metrics = new MetricsCollector();
  // Metrics is fed by canonical telemetry events (telemetry → metrics layering).
  telemetry.subscribe((event) => metrics.record(event));
  return {
    telemetry,
    metrics,
    audit: new ExecutionAuditEngine(),
    health: new PassiveHealthCollector(),
    installed: false,
  };
}

/** The process-wide observability stack (created on first access). */
export function observability(): ObservabilityStack {
  if (!globalRef.__lawrenceObservability) globalRef.__lawrenceObservability = build();
  return globalRef.__lawrenceObservability;
}

/**
 * Register the observability middleware into the execution chain. Idempotent —
 * registers exactly once per process regardless of how many bootstrap paths call
 * it. Returns the stack so callers can read telemetry/metrics/audit/health.
 */
export function installExecutionObservability(): ObservabilityStack {
  const stack = observability();
  if (!stack.installed) {
    registerMiddleware(stack.telemetry);
    registerMiddleware(stack.audit);
    registerMiddleware(stack.health);
    stack.installed = true;
  }
  return stack;
}
