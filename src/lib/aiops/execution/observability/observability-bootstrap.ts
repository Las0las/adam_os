// Execution Observability — wiring (Milestone 5.0; reworked for the event bus
// in Milestone 5.5).
//
// Instantiates the process-wide observability stack and connects it:
//
//   pipeline ─▶ ExecutionEventPublisher (the ONE middleware) ─▶ ExecutionEventBus
//                                                                   │
//                          ┌────────────────────┬────────────────┼────────────────┐
//                       telemetry            metrics            audit            health
//                                          (bus subscribers — priority-independent peers)
//
// Every inference automatically produces telemetry, metrics, audit records, and
// provider-health observations, with no change to providers, routing, or
// applications. Idempotent: the publisher is registered exactly once per process.
//
// The singletons live on globalThis (not module scope): Next.js can duplicate a
// module across route chunks, and execution is a process-global concern, so a
// per-module instance could split observation across two stacks.

import { registerMiddleware } from "./execution-middleware";
import { ExecutionEventBus } from "./execution-event-bus";
import { ExecutionEventPublisher } from "./event-bus-publisher";
import { ExecutionTelemetryEngine } from "./telemetry-engine";
import { MetricsCollector } from "./metrics-collector";
import { ExecutionAuditEngine } from "./audit-engine";
import { PassiveHealthCollector } from "./health-collector";

export interface ObservabilityStack {
  bus: ExecutionEventBus;
  publisher: ExecutionEventPublisher;
  telemetry: ExecutionTelemetryEngine;
  metrics: MetricsCollector;
  audit: ExecutionAuditEngine;
  health: PassiveHealthCollector;
  /** True once the publisher has been registered into the execution chain. */
  installed: boolean;
}

const globalRef = globalThis as unknown as { __lawrenceObservability?: ObservabilityStack };

function build(): ObservabilityStack {
  const bus = new ExecutionEventBus();
  const telemetry = new ExecutionTelemetryEngine();
  const metrics = new MetricsCollector();
  const audit = new ExecutionAuditEngine();
  const health = new PassiveHealthCollector();
  // The four core observers are bus subscribers — peers, order-independent.
  bus.subscribe(telemetry);
  bus.subscribe(metrics);
  bus.subscribe(audit);
  bus.subscribe(health);
  return {
    bus,
    publisher: new ExecutionEventPublisher(bus),
    telemetry,
    metrics,
    audit,
    health,
    installed: false,
  };
}

/** The process-wide observability stack (created on first access). */
export function observability(): ObservabilityStack {
  if (!globalRef.__lawrenceObservability) globalRef.__lawrenceObservability = build();
  return globalRef.__lawrenceObservability;
}

/**
 * Register the event-bus publisher into the execution chain. Idempotent —
 * registers exactly once per process regardless of how many bootstrap paths call
 * it. Returns the stack so callers can read the bus / telemetry / metrics /
 * audit / health.
 */
export function installExecutionObservability(): ObservabilityStack {
  const stack = observability();
  if (!stack.installed) {
    registerMiddleware(stack.publisher);
    stack.installed = true;
  }
  return stack;
}
