// IOS-016 — Traffic Replay Engine (per AS-001) — types + policy.
//
// Replays recorded execution inputs THROUGH the public execution API
// (executeInference, via IOS-003 routing) — never invoking providers directly,
// never mutating historical events, RoutingDecisions, ExecutionPlans, or
// ProviderHealth, and never altering production routing. Replay executions are
// ISOLATED: they observe on a replay-scoped event bus, so production health
// (IOS-013) and production metrics are never contaminated. Results are immutable
// and clearly marked as replays. Governed by immutable ReplayPolicy; default
// DISABLED.

import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import type { Capability } from "@/lib/aiops/routing/routing-types";

/** Reserved tenant id that marks every replay execution as isolated. */
export const REPLAY_TENANT = "__replay__";

export type ReplayStatus = "completed" | "failed";
export type ReplayOutcome = "success" | "failure" | "not_eligible";

/** A recorded execution input to replay (a deterministic fixture). */
export interface ReplayRecord {
  recordId: string;
  /** Provenance: the original execution this input came from (optional). */
  sourceExecutionId?: string;
  inputMessages: Array<{ role: string; content: string }>;
  provider: string;
  model: string;
  workloadType: string;
  requiredCapabilities?: Capability[];
  responseFormat?: "text" | "json";
  outputSchema?: Record<string, unknown> | null;
}

export interface ReplayTokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

/** An immutable result of replaying one record. Always marked `isReplay: true`. */
export interface ReplayResult {
  replayId: string;
  recordId: string;
  sourceExecutionId: string | null;
  /** The new (isolated) execution id minted by the pipeline for this replay. */
  replayExecutionId: string;
  provider: string;
  model: string;
  workloadType: string;
  executionOutcome: ReplayOutcome;
  success: boolean;
  latencyMs: number;
  tokenUsage: ReplayTokenUsage | null;
  errorKind: string | null;
  /** Marks this as a replay execution (never a production run). */
  isReplay: true;
}

/** An immutable record of one replay run over a set of records. */
export interface ReplayRun {
  replayId: string;
  startedAt: number;
  endedAt: number;
  status: ReplayStatus;
  results: ReplayResult[];
}

export type ReplayMode = "disabled" | "enabled";

export interface ReplayPolicy {
  mode: ReplayMode;
  eligibleProviders: string[];
  eligibleModels: string[];
  eligibleWorkloads: string[];
  maxRecordsPerRun: number;
  bypassCache: boolean;
  disableRetry: boolean;
  disableFallback: boolean;
}

export function defaultReplayPolicy(): ReplayPolicy {
  return {
    mode: "disabled",
    eligibleProviders: [],
    eligibleModels: [],
    eligibleWorkloads: [],
    maxRecordsPerRun: 1000,
    bypassCache: false,
    disableRetry: false,
    disableFallback: false,
  };
}

export class ReplayPolicyStore {
  private policy: ReplayPolicy;
  constructor(policy: ReplayPolicy = defaultReplayPolicy()) {
    this.policy = deepFreeze(policy);
  }
  current(): ReplayPolicy {
    return this.policy;
  }
  configure(policy: ReplayPolicy): void {
    this.policy = deepFreeze(policy);
  }
}

export function replayEligible(policy: ReplayPolicy, provider: string, model: string, workloadType: string): boolean {
  if (policy.eligibleProviders.length > 0 && !policy.eligibleProviders.includes(provider)) return false;
  if (policy.eligibleModels.length > 0 && !policy.eligibleModels.includes(model)) return false;
  if (policy.eligibleWorkloads.length > 0 && !policy.eligibleWorkloads.includes(workloadType)) return false;
  return true;
}
