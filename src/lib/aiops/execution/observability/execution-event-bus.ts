// Execution Event Bus (Milestone 5.5).
//
//   Execution Pipeline → Execution Event Bus → Subscribers
//                                              (telemetry, metrics, audit, health)
//
// A canonical publish/subscribe seam that decouples observation from middleware.
// A single bridge middleware publishes immutable ExecutionEvents here; every
// observer subscribes. Future middleware subscribes to events rather than
// depending on telemetry or the collectors directly.
//
// Deliberate constraints (this is intentionally minimal):
//   • SYNCHRONOUS delivery — publish() returns only after every subscriber has
//     been invoked. No async queue, no microtask deferral.
//   • PRIORITY-INDEPENDENT — subscribers are peers. The bus assigns no ordering
//     semantics; a subscriber must not assume it runs before/after another.
//   • NO retries, NO persistence, NO external brokers.
//   • Delivery is GUARDED — a throwing subscriber is isolated so it can neither
//     break a peer subscriber nor affect execution.

import { guard } from "./execution-middleware";

/**
 * The minimal shape every event on the bus shares (Milestone 5.5; broadened in
 * 6.0). Both the execution events (telemetry/audit/health) and the security
 * events ride the same bus, so the bus is typed to this structural base — it
 * stays decoupled from any specific event family. Subscribers narrow by `type`
 * (e.g. `isExecutionEvent` / `isSecurityEvent`) to read family-specific fields.
 */
export interface BusEvent {
  type: string;
  executionId: string;
  requestId: string;
  tenantId: string | null;
  provider: string;
  model: string;
  workloadType: string;
  /** Epoch milliseconds (wall clock). */
  timestamp: number;
}

/** A named consumer of bus events. */
export interface ExecutionEventSubscriber {
  name: string;
  onEvent(event: BusEvent): void;
}

export class ExecutionEventBus {
  private readonly subscribers_: ExecutionEventSubscriber[] = [];

  /** Register a subscriber. Returns an unsubscribe function. Idempotent per
   *  reference — the same subscriber object is not added twice. */
  subscribe(subscriber: ExecutionEventSubscriber): () => void {
    if (!this.subscribers_.includes(subscriber)) this.subscribers_.push(subscriber);
    return () => {
      const i = this.subscribers_.indexOf(subscriber);
      if (i >= 0) this.subscribers_.splice(i, 1);
    };
  }

  /** Synchronously deliver an event to every subscriber. Order is not part of
   *  the contract; each delivery is isolated so one failure cannot affect
   *  another subscriber or the caller. Never throws. */
  publish(event: BusEvent): void {
    for (const subscriber of this.subscribers_) {
      guard(() => subscriber.onEvent(event));
    }
  }

  /** Current subscribers (a copy). */
  subscribers(): ExecutionEventSubscriber[] {
    return [...this.subscribers_];
  }

  /** Remove all subscribers (test isolation). */
  clear(): void {
    this.subscribers_.length = 0;
  }
}
