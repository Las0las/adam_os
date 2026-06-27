// Security Middleware Platform (Milestone 6.0) — wiring.
//
// Builds the process-wide security stack and attaches it to the existing
// execution infrastructure:
//
//   pipeline ─▶ Prompt Firewall (1) ─▶ PII Redaction (2) ─▶ Provider
//                                                              │
//                                                              ▼
//            ◀─ Response Validator (3) ◀──────────────────────┘
//   all publish onto the Execution Event Bus ─▶ Security Metrics (subscriber)
//
// The firewall, PII redaction, and validator register as execution middleware
// (priorities 1/2/3, all before the event publisher at 10). The security metrics
// collector subscribes to the same bus the telemetry/audit/metrics subscribers
// use. Idempotent: registers exactly once per process. Depends on the
// observability stack only for the shared bus.

import { registerMiddleware } from "@/lib/aiops/execution/observability/execution-middleware";
import { observability } from "@/lib/aiops/execution/observability/observability-bootstrap";
import type { ExecutionEventBus } from "@/lib/aiops/execution/observability/execution-event-bus";
import { PromptFirewall } from "./prompt-firewall";
import { PIIRedaction } from "./pii-redaction";
import { ResponseValidator } from "./response-validator";
import { SecurityMetricsCollector } from "./security-metrics";
import { SecurityPolicyStore, type SecurityPolicy } from "./security-types";

export interface SecurityStack {
  store: SecurityPolicyStore;
  firewall: PromptFirewall;
  pii: PIIRedaction;
  validator: ResponseValidator;
  metrics: SecurityMetricsCollector;
  installed: boolean;
}

const globalRef = globalThis as unknown as { __lawrenceSecurity?: SecurityStack };

function build(bus: ExecutionEventBus): SecurityStack {
  const store = new SecurityPolicyStore();
  return {
    store,
    firewall: new PromptFirewall(bus, store),
    pii: new PIIRedaction(bus, store),
    validator: new ResponseValidator(bus, store),
    metrics: new SecurityMetricsCollector(),
    installed: false,
  };
}

/** The process-wide security stack (created on first access, bound to the
 *  observability bus). */
export function security(): SecurityStack {
  if (!globalRef.__lawrenceSecurity) {
    globalRef.__lawrenceSecurity = build(observability().bus);
  }
  return globalRef.__lawrenceSecurity;
}

/**
 * Register the security middleware into the execution chain and subscribe the
 * security metrics collector to the bus. Idempotent. Optionally applies an
 * initial policy. Returns the stack so callers can reconfigure the policy or
 * read security metrics.
 */
export function installSecurityMiddleware(policy?: SecurityPolicy): SecurityStack {
  const stack = security();
  if (policy) stack.store.configure(policy);
  if (!stack.installed) {
    registerMiddleware(stack.firewall);
    registerMiddleware(stack.pii);
    registerMiddleware(stack.validator);
    observability().bus.subscribe(stack.metrics);
    stack.installed = true;
  }
  return stack;
}
