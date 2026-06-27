// IOS-008 — Batch Scheduler — wiring.
//
// Builds the process-wide Batch Scheduler and attaches it to the execution chain
// at priority 0.5 (after the Prompt Cache, before the Security middleware), with
// its metrics collector subscribed to the shared bus. Idempotent. The default
// policy is DISABLED, so installing it changes nothing until a tenant enables
// batching.

import { registerExecutionHook } from "@/lib/aiops/execution/execution-hooks";
import { observability } from "@/lib/aiops/execution/observability/observability-bootstrap";
import { BatchScheduler } from "./batch-scheduler";
import { BatchMetricsCollector } from "./batch-metrics";
import { BatchPolicyStore, type BatchPolicy } from "./batch-types";

export interface BatchStack {
  policyStore: BatchPolicyStore;
  scheduler: BatchScheduler;
  metrics: BatchMetricsCollector;
  installed: boolean;
}

const globalRef = globalThis as unknown as { __lawrenceBatch?: BatchStack };

export function batchPlatform(): BatchStack {
  if (!globalRef.__lawrenceBatch) {
    const policyStore = new BatchPolicyStore();
    globalRef.__lawrenceBatch = {
      policyStore,
      scheduler: new BatchScheduler(observability().bus, policyStore),
      metrics: new BatchMetricsCollector(),
      installed: false,
    };
  }
  return globalRef.__lawrenceBatch;
}

/**
 * Register the Batch Scheduler middleware into the execution chain and subscribe
 * its metrics collector to the bus. Idempotent. Optionally applies an initial
 * policy.
 */
export function installBatchScheduler(policy?: BatchPolicy): BatchStack {
  const stack = batchPlatform();
  if (policy) stack.policyStore.configure(policy);
  if (!stack.installed) {
    registerExecutionHook(stack.scheduler);
    observability().bus.subscribe(stack.metrics);
    stack.installed = true;
  }
  return stack;
}
