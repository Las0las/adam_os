// Execution Event Bus (Milestone 5.5) — pipeline → bus bridge.
//
// The ONE middleware the observability stack registers into the execution hook
// chain. It builds each canonical event exactly once from the lifecycle and
// publishes it to the event bus; every observer is a bus subscriber, not a
// middleware. This is the single point where the execution lifecycle is
// translated into events — observers no longer translate ctx/result themselves.
//
// Observation only: it never mutates the request, response, or context, and
// (via guard) never throws, so it cannot alter execution.

import type {
  InferenceExecutionContext,
  InferenceExecutionResult,
} from "../execution-types";
import type { ExecutionError } from "../execution-errors";
import {
  executionStarted,
  executionCompleted,
  executionFailed,
} from "./execution-events";
import {
  guard,
  MIDDLEWARE_PRIORITY,
  type ExecutionMiddleware,
} from "./execution-middleware";
import type { ExecutionEventBus } from "./execution-event-bus";

export class ExecutionEventPublisher implements ExecutionMiddleware {
  readonly name = "event-bus";
  readonly priority = MIDDLEWARE_PRIORITY.eventBus;

  constructor(private readonly bus: ExecutionEventBus) {}

  beforeExecute(ctx: InferenceExecutionContext): void {
    guard(() => this.bus.publish(executionStarted(ctx)));
  }

  afterExecute(ctx: InferenceExecutionContext, result: InferenceExecutionResult): void {
    guard(() => this.bus.publish(executionCompleted(ctx, result)));
  }

  executionFailed(ctx: InferenceExecutionContext, error: ExecutionError): void {
    guard(() => this.bus.publish(executionFailed(ctx, error)));
  }
}
