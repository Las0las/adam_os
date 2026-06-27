// IOS-014 — Benchmark Harness (per AS-001) — types + policy.
//
// A deterministic, specification-driven subsystem for executing controlled
// benchmark runs across providers/models/workloads/fixtures. It is OBSERVATIONAL
// and EVALUATIVE: it drives benchmark cases THROUGH the existing public execution
// API (IOS-004 executeInference, via IOS-003 routing) and measures the outcome. It
// NEVER invokes providers directly, bypasses the pipeline, mutates routing/the
// Execution Plan, or influences production routing. Benchmarking SHALL NOT become
// runtime routing logic. Behavior is governed by immutable BenchmarkPolicy
// objects; the default policy is DISABLED (no-op).

import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import type { Capability } from "@/lib/aiops/routing/routing-types";

export type BenchmarkStatus = "completed" | "failed";
export type ScoringStrategy = "success" | "exact_match" | "contains" | "json_keys";
export type BenchmarkOutcome = "success" | "failure" | "not_eligible";

/** A deterministic benchmark fixture. No random generation. */
export interface BenchmarkCase {
  caseId: string;
  inputMessages: Array<{ role: string; content: string }>;
  /** Expected output shape (keys) for JSON cases. */
  expectedOutputShape?: Record<string, unknown> | null;
  requiredCapabilities?: Capability[];
  workloadType?: string;
  responseFormat?: "text" | "json";
  /** Deterministic scoring inputs (expected text / keys). */
  scoringMetadata?: { expected?: string; expectedKeys?: string[] };
}

export interface BenchmarkSuite {
  suiteId: string;
  name: string;
  workloadType: string;
  cases: BenchmarkCase[];
  eligibleProviders: string[];
  eligibleModels: string[];
  scoringStrategy: ScoringStrategy;
  /** Per-case timeout budget (ms); enforcement is delegated to the pipeline's
   *  normalized timeout handling. */
  timeoutMs: number;
}

export interface BenchmarkTokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

/** An immutable per-case measurement. */
export interface BenchmarkResult {
  provider: string;
  model: string;
  workloadType: string;
  caseId: string;
  latencyMs: number;
  tokenUsage: BenchmarkTokenUsage | null;
  executionOutcome: BenchmarkOutcome;
  success: boolean;
  normalizedScore: number;
  validationErrors: string[];
  retryCount: number;
  fallbackOccurred: boolean;
  circuitBreakerState: string;
  /** Reference (provider|model key) into the IOS-013 ProviderHealth store. */
  healthSnapshotRef: string;
}

/** An immutable record of one suite executed against one provider+model. */
export interface BenchmarkRun {
  runId: string;
  suiteId: string;
  provider: string;
  model: string;
  workloadType: string;
  startedAt: number;
  endedAt: number;
  status: BenchmarkStatus;
  results: BenchmarkResult[];
}

export type BenchmarkMode = "disabled" | "enabled";

export interface BenchmarkPolicy {
  mode: BenchmarkMode;
  eligibleProviders: string[];
  eligibleModels: string[];
  eligibleWorkloads: string[];
  maxCasesPerRun: number;
  timeoutMs: number;
  bypassCache: boolean;
  bypassSemanticCache: boolean;
  disableFallback: boolean;
  disableRetry: boolean;
}

/** Default policy: benchmarking OFF. */
export function defaultBenchmarkPolicy(): BenchmarkPolicy {
  return {
    mode: "disabled",
    eligibleProviders: [],
    eligibleModels: [],
    eligibleWorkloads: [],
    maxCasesPerRun: 100,
    timeoutMs: 30_000,
    bypassCache: false,
    bypassSemanticCache: false,
    disableFallback: false,
    disableRetry: false,
  };
}

export class BenchmarkPolicyStore {
  private policy: BenchmarkPolicy;
  constructor(policy: BenchmarkPolicy = defaultBenchmarkPolicy()) {
    this.policy = deepFreeze(policy);
  }
  current(): BenchmarkPolicy {
    return this.policy;
  }
  configure(policy: BenchmarkPolicy): void {
    this.policy = deepFreeze(policy);
  }
}

/** Whether the policy permits benchmarking this provider/model/workload. */
export function benchmarkEligible(policy: BenchmarkPolicy, provider: string, model: string, workloadType: string): boolean {
  if (policy.eligibleProviders.length > 0 && !policy.eligibleProviders.includes(provider)) return false;
  if (policy.eligibleModels.length > 0 && !policy.eligibleModels.includes(model)) return false;
  if (policy.eligibleWorkloads.length > 0 && !policy.eligibleWorkloads.includes(workloadType)) return false;
  return true;
}
