// IOS-008 — Batch Scheduler — passive metrics.
//
// A bus subscriber that folds batch events into running counters. Collection
// contract only — no dashboards, no persistence.

import type { BusEvent, ExecutionEventSubscriber } from "@/lib/aiops/execution/observability/execution-event-bus";
import { isBatchEvent } from "./batch-events";

export interface BatchMetricsSnapshot {
  batchesCreated: number;
  batchesDispatched: number;
  /** Dispatched specifically due to the wait timeout. */
  batchesExpired: number;
  requestsBatched: number;
  requestsBypassed: number;
  /** Mean batch size across dispatched + expired batches. */
  averageBatchSize: number;
  /** Mean wait time (ms) from batch creation to dispatch — the batching latency. */
  batchingLatencyMs: number;
  /** Mean scheduling delay (ms) a batched request waited (== batching latency). */
  schedulingDelayMs: number;
  /** Mean batchSize / capacity across dispatched batches (0 when unknown). */
  providerBatchUtilization: number;
}

export class BatchMetricsCollector implements ExecutionEventSubscriber {
  readonly name = "batch-metrics";

  private batchesCreated = 0;
  private batchesDispatched = 0;
  private batchesExpired = 0;
  private requestsBatched = 0;
  private requestsBypassed = 0;
  private sizeTotal = 0;
  private dispatchCount = 0; // dispatched + expired
  private waitMsTotal = 0;
  private utilizationTotal = 0;
  private utilizationSamples = 0;

  onEvent(event: BusEvent): void {
    if (!isBatchEvent(event)) return;
    switch (event.type) {
      case "batch.created":
        this.batchesCreated += 1;
        break;
      case "batch.dispatched":
        this.batchesDispatched += 1;
        this.dispatchCount += 1;
        this.sizeTotal += event.batchSize;
        this.requestsBatched += event.batchSize;
        this.waitMsTotal += event.waitMs;
        if (event.capacity > 0) {
          this.utilizationTotal += event.batchSize / event.capacity;
          this.utilizationSamples += 1;
        }
        break;
      case "batch.expired":
        this.batchesExpired += 1;
        this.dispatchCount += 1;
        this.sizeTotal += event.batchSize;
        this.requestsBatched += event.batchSize;
        this.waitMsTotal += event.waitMs;
        break;
      case "batch.bypassed":
        this.requestsBypassed += 1;
        break;
      // batch.queued / batch.completed carry no additional counters.
    }
  }

  snapshot(): BatchMetricsSnapshot {
    const avgWait = this.dispatchCount === 0 ? 0 : this.waitMsTotal / this.dispatchCount;
    return {
      batchesCreated: this.batchesCreated,
      batchesDispatched: this.batchesDispatched,
      batchesExpired: this.batchesExpired,
      requestsBatched: this.requestsBatched,
      requestsBypassed: this.requestsBypassed,
      averageBatchSize: this.dispatchCount === 0 ? 0 : this.sizeTotal / this.dispatchCount,
      batchingLatencyMs: avgWait,
      schedulingDelayMs: avgWait,
      providerBatchUtilization: this.utilizationSamples === 0 ? 0 : this.utilizationTotal / this.utilizationSamples,
    };
  }

  reset(): void {
    this.batchesCreated = 0;
    this.batchesDispatched = 0;
    this.batchesExpired = 0;
    this.requestsBatched = 0;
    this.requestsBypassed = 0;
    this.sizeTotal = 0;
    this.dispatchCount = 0;
    this.waitMsTotal = 0;
    this.utilizationTotal = 0;
    this.utilizationSamples = 0;
  }
}
