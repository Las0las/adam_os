// Execution Observability (Milestone 5.0, deliverable #1) — telemetry engine.
//
// The telemetry engine is the first middleware in the chain. It subscribes to
// BeforeExecute / AfterExecute / ExecutionFailed and turns each into exactly one
// canonical ExecutionEvent (started / completed / failed). It captures events in
// memory and fans them out to subscribers (the metrics collector subscribes
// here). There is NO persistence in this milestone — only the capture + fan-out
// contract. Observation only: it never mutates the request, response, or context.

import type {
  InferenceExecutionContext,
  InferenceExecutionResult,
} from "../execution-types";
import type { ExecutionError } from "../execution-errors";
import {
  executionStarted,
  executionCompleted,
  executionFailed,
  type ExecutionEvent,
} from "./execution-events";
import {
  guard,
  MIDDLEWARE_PRIORITY,
  type ExecutionMiddleware,
} from "./execution-middleware";

export type ExecutionEventListener = (event: ExecutionEvent) => void;

/** In-memory telemetry engine. Captures canonical events and notifies listeners.
 *  Bounded so a long-lived process cannot grow without limit (no persistence). */
export class ExecutionTelemetryEngine implements ExecutionMiddleware {
  readonly name = "telemetry";
  readonly priority = MIDDLEWARE_PRIORITY.telemetry;

  private readonly events_: ExecutionEvent[] = [];
  private readonly listeners: ExecutionEventListener[] = [];
  private readonly capacity: number;

  constructor(capacity = 1000) {
    this.capacity = Math.max(1, capacity);
  }

  /** Subscribe to every captured event. Returns an unsubscribe function. */
  subscribe(listener: ExecutionEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      const i = this.listeners.indexOf(listener);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }

  /** Captured events, oldest first (a copy). */
  events(): ExecutionEvent[] {
    return [...this.events_];
  }

  /** Most recently captured event, or null. */
  last(): ExecutionEvent | null {
    return this.events_[this.events_.length - 1] ?? null;
  }

  /** Clear captured events (test isolation). Does not drop subscribers. */
  reset(): void {
    this.events_.length = 0;
  }

  private capture(event: ExecutionEvent): void {
    this.events_.push(event);
    if (this.events_.length > this.capacity) this.events_.shift();
    for (const listener of this.listeners) {
      guard(() => listener(event));
    }
  }

  beforeExecute(ctx: InferenceExecutionContext): void {
    guard(() => this.capture(executionStarted(ctx)));
  }

  afterExecute(ctx: InferenceExecutionContext, result: InferenceExecutionResult): void {
    guard(() => this.capture(executionCompleted(ctx, result)));
  }

  executionFailed(ctx: InferenceExecutionContext, error: ExecutionError): void {
    guard(() => this.capture(executionFailed(ctx, error)));
  }
}
