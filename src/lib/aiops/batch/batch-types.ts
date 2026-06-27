// IOS-008 — Batch Scheduler (per AS-001) — policy + contracts.
//
// Conforms to IOS-003 (Routing), IOS-004 (Execution Pipeline), IOS-005 (Event
// Bus), IOS-006 (Security), IOS-007 (Cache). Introduces no architectural change:
// the Batch Scheduler is execution middleware that coordinates the timing of
// compatible requests. The default policy is DISABLED so installing it changes
// nothing until a tenant opts in. Policies are immutable during execution.

import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import { fingerprint } from "@/lib/aiops/execution/observability/fingerprint";
import type { CompletionRequest } from "@/lib/aiops/models/model-provider";
import type { InferenceExecutionContext } from "@/lib/aiops/execution/execution-types";

export type BatchMode = "disabled" | "enabled";

export interface BatchPolicy {
  mode: BatchMode;
  /** Maximum number of requests in one batch (>= 1). */
  maxBatchSize: number;
  /** Maximum time (ms) a batch waits before dispatching. */
  maxWaitMs: number;
  /** Workload types eligible for batching. Empty = all. */
  supportedWorkloads: string[];
  /** Providers eligible for batching (by registry id). Empty = all. */
  supportedProviders: string[];
  /** Models eligible for batching (by model key). Empty = all. */
  supportedModels: string[];
  /** When true, skip batching for this execution (dispatch immediately). */
  bypass: boolean;
}

/** Default policy: batching OFF. Enabling is a per-tenant decision. */
export function defaultBatchPolicy(): BatchPolicy {
  return {
    mode: "disabled",
    maxBatchSize: 8,
    maxWaitMs: 50,
    supportedWorkloads: [],
    supportedProviders: [],
    supportedModels: [],
    bypass: false,
  };
}

/** Holds the active batch policy as an immutable snapshot. */
export class BatchPolicyStore {
  private policy: BatchPolicy;

  constructor(policy: BatchPolicy = defaultBatchPolicy()) {
    this.policy = deepFreeze(policy);
  }

  current(): BatchPolicy {
    return this.policy;
  }

  configure(policy: BatchPolicy): void {
    this.policy = deepFreeze(policy);
  }
}

/**
 * Compatibility key. Requests MAY be batched only when these match: provider,
 * model, workload type, and response format. (Security and execution policy are
 * process-global snapshots and therefore identical across in-process requests;
 * they are part of the eligibility contract and are documented in IOS-008.)
 * Two requests with the same key are batch-compatible.
 */
export function batchKey(ctx: InferenceExecutionContext, request: CompletionRequest): string {
  return [
    ctx.provider,
    ctx.model,
    ctx.workloadType,
    fingerprint(request.outputSchema ?? null),
  ].join("|");
}

/** Whether the policy permits batching this execution (workload/provider/model
 *  filters). Does NOT consider mode/bypass — the scheduler checks those. */
export function batchEligible(policy: BatchPolicy, ctx: InferenceExecutionContext): boolean {
  if (policy.supportedWorkloads.length > 0 && !policy.supportedWorkloads.includes(ctx.workloadType)) return false;
  if (policy.supportedProviders.length > 0 && !policy.supportedProviders.includes(ctx.provider)) return false;
  if (policy.supportedModels.length > 0 && !policy.supportedModels.includes(ctx.model)) return false;
  return true;
}

/** Chain position: the Batch Scheduler runs after the Prompt Cache (priority 0)
 *  and before the Security middleware (firewall priority 1), per IOS-008
 *  ordering. It coordinates timing via `resolveCompletion`; because the cache's
 *  resolveCompletion short-circuits on a hit, the scheduler is never consulted
 *  for cache hits. */
export const BATCH_PRIORITY = 0.5;
