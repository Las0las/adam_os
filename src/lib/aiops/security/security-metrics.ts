// Security Middleware Platform (Milestone 6.0, deliverable #6) — Security Metrics.
//
// A passive bus subscriber that folds canonical security events into running
// counters. Like the execution metrics collector it establishes the collection
// contract only — no dashboards, no historical aggregation, no persistence.

import type { BusEvent, ExecutionEventSubscriber } from "@/lib/aiops/execution/observability/execution-event-bus";
import { isSecurityEvent } from "./security-events";

export interface SecurityMetricsSnapshot {
  promptsInspected: number;
  promptsRejected: number;
  piiDetections: number;
  piiMasked: number;
  validationFailures: number;
  validationSuccesses: number;
  /** successes / (successes + failures); 1 when no validations have run. */
  validationSuccessRate: number;
}

export class SecurityMetricsCollector implements ExecutionEventSubscriber {
  readonly name = "security-metrics";

  private promptsInspected = 0;
  private promptsRejected = 0;
  private piiDetections = 0;
  private piiMasked = 0;
  private validationFailures = 0;
  private validationSuccesses = 0;

  onEvent(event: BusEvent): void {
    if (!isSecurityEvent(event)) return;
    switch (event.type) {
      case "security.prompt_inspected":
        this.promptsInspected += 1;
        if (event.outcome === "rejected") this.promptsRejected += 1;
        break;
      case "security.pii_detected":
        this.piiDetections += event.count;
        break;
      case "security.pii_masked":
        this.piiMasked += event.count;
        break;
      case "security.validation_succeeded":
        this.validationSuccesses += 1;
        break;
      case "security.validation_failed":
        this.validationFailures += 1;
        break;
    }
  }

  snapshot(): SecurityMetricsSnapshot {
    const validations = this.validationSuccesses + this.validationFailures;
    return {
      promptsInspected: this.promptsInspected,
      promptsRejected: this.promptsRejected,
      piiDetections: this.piiDetections,
      piiMasked: this.piiMasked,
      validationFailures: this.validationFailures,
      validationSuccesses: this.validationSuccesses,
      validationSuccessRate: validations === 0 ? 1 : this.validationSuccesses / validations,
    };
  }

  reset(): void {
    this.promptsInspected = 0;
    this.promptsRejected = 0;
    this.piiDetections = 0;
    this.piiMasked = 0;
    this.validationFailures = 0;
    this.validationSuccesses = 0;
  }
}
