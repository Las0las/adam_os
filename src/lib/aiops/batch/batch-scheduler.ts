// IOS-008 — Batch Scheduler — execution middleware.
//
// Groups compatible inference requests into deterministic batches while
// preserving every execution contract. It attaches via `resolveCompletion`
// (priority 0.5: after the Prompt Cache, before the Security middleware). On a
// cache hit the pipeline's resolve loop short-circuits before reaching the
// scheduler, so cache hits are never batched. For a cache miss, the scheduler
// HOLDS the request until its batch dispatches, then returns null — so the
// request proceeds normally through Prompt Firewall → PII Redaction → Provider →
// Response Validator. The scheduler therefore NEVER bypasses security,
// validation, routing, telemetry, or audit; it only coordinates timing. Each
// request keeps its own request/response (request isolation + response ordering
// are preserved by construction). When batching is disabled (default) the
// scheduler returns null immediately — behavior is identical to its absence.

import type { CompletionRequest, CompletionResponse } from "@/lib/aiops/models/model-provider";
import type { InferenceExecutionContext, ExecutionHook } from "@/lib/aiops/execution/execution-types";
import { fingerprint } from "@/lib/aiops/execution/observability/fingerprint";
import { guard } from "@/lib/aiops/execution/observability/execution-middleware";
import { observedNowMs } from "@/lib/aiops/execution/observability/observability-clock";
import type { ExecutionEventBus } from "@/lib/aiops/execution/observability/execution-event-bus";
import type { TimerHandle } from "./batch-queue";
import { BatchCoordinator } from "./batch-coordinator";
import {
  batchCreated,
  batchQueued,
  batchDispatched,
  batchCompleted,
  batchExpired,
  batchBypassed,
} from "./batch-events";
import {
  BATCH_PRIORITY,
  batchEligible,
  batchKey,
  type BatchPolicyStore,
} from "./batch-types";

export interface BatchSchedulerDeps {
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => TimerHandle;
  clearTimer?: (handle: TimerHandle) => void;
}

export class BatchScheduler implements ExecutionHook {
  readonly name = "batch-scheduler";
  readonly priority = BATCH_PRIORITY;

  private readonly coordinator: BatchCoordinator;

  constructor(
    private readonly bus: ExecutionEventBus,
    private readonly store: BatchPolicyStore,
    deps: BatchSchedulerDeps = {},
  ) {
    const now = deps.now ?? observedNowMs;
    const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms) as unknown as TimerHandle);
    const clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
    this.coordinator = new BatchCoordinator({
      policy: () => store.current(),
      now,
      setTimer,
      clearTimer,
      callbacks: {
        onCreated: (group) => {
          const lead = group.entries[0];
          if (lead) guard(() => this.bus.publish(batchCreated(lead.ctx, group.digest)));
        },
        onQueued: (group, entry, position) => {
          guard(() => this.bus.publish(batchQueued(entry.ctx, group.digest, position)));
        },
        onDispatched: (group, reason, waitMs) => {
          const lead = group.entries[0];
          if (!lead) return;
          const size = group.entries.length;
          if (reason === "timeout") {
            guard(() => this.bus.publish(batchExpired(lead.ctx, group.digest, size, waitMs)));
          } else {
            guard(() => this.bus.publish(batchDispatched(lead.ctx, group.digest, "size", size, store.current().maxBatchSize, waitMs)));
          }
          guard(() => this.bus.publish(batchCompleted(lead.ctx, group.digest, size)));
        },
      },
    });
  }

  resolveCompletion(request: CompletionRequest, ctx: InferenceExecutionContext): Promise<CompletionResponse | null> | null {
    const policy = this.store.current();
    if (policy.mode !== "enabled") return null; // disabled → proceed immediately, no events
    if (policy.bypass) {
      guard(() => this.bus.publish(batchBypassed(ctx, "bypass")));
      return null;
    }
    if (!batchEligible(policy, ctx)) {
      guard(() => this.bus.publish(batchBypassed(ctx, "ineligible")));
      return null;
    }
    const key = batchKey(ctx, request);
    const digest = fingerprint(key);
    // Hold the request until its batch dispatches; return null so it then
    // continues through security and the provider. NEVER returns a response (it
    // does not short-circuit the provider).
    return new Promise<CompletionResponse | null>((resolve) => {
      this.coordinator.enqueue(key, digest, { ctx, release: () => resolve(null) });
    });
  }

  /** Dispatch all forming batches now (e.g. shutdown / test draining). */
  flush(): void {
    this.coordinator.flush();
  }

  /** Number of requests currently held awaiting dispatch. */
  pending(): number {
    return this.coordinator.pending();
  }
}
