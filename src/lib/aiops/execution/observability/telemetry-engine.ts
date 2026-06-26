// Execution Observability (Milestone 5.0, deliverable #1; reworked in 5.5).
//
// The telemetry engine is now a BUS SUBSCRIBER. It no longer translates the
// execution lifecycle itself — the event-bus publisher does that once — it
// simply captures the canonical events it receives. There is NO persistence:
// only in-memory capture, bounded so a long-lived process cannot grow without
// limit. Observation only.

import type { BusEvent, ExecutionEventSubscriber } from "./execution-event-bus";

/** In-memory telemetry engine. Captures every canonical event from the bus —
 *  execution events and security events alike (it is the general sink). */
export class ExecutionTelemetryEngine implements ExecutionEventSubscriber {
  readonly name = "telemetry";

  private readonly events_: BusEvent[] = [];
  private readonly capacity: number;

  constructor(capacity = 1000) {
    this.capacity = Math.max(1, capacity);
  }

  onEvent(event: BusEvent): void {
    this.events_.push(event);
    if (this.events_.length > this.capacity) this.events_.shift();
  }

  /** Captured events, oldest first (a copy). */
  events(): BusEvent[] {
    return [...this.events_];
  }

  /** Most recently captured event, or null. */
  last(): BusEvent | null {
    return this.events_[this.events_.length - 1] ?? null;
  }

  /** Clear captured events (test isolation). */
  reset(): void {
    this.events_.length = 0;
  }
}
