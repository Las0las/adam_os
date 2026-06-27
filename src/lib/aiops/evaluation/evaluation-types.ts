// IOS-017 — Evaluation Engine (per AS-001) — types + policy.
//
// An OBSERVATIONAL subsystem that evaluates COMPLETED executions and produces the
// canonical EvaluationResult / EvaluationReport. It scores executions that were
// produced within an Isolated Execution Environment (reusing the IOS-016 model),
// reading canonical objects (ExecutionPlan, RoutingDecision, ProviderHealthSnapshot,
// BenchmarkResult, ReplayResult, Explanation, execution events) by reference. It
// NEVER influences execution or routing, authorizes targets, or invokes providers
// directly. Governed by immutable EvaluationPolicy; default DISABLED.

import { deepFreeze } from "@/lib/aiops/routing/routing-types";

/** A deterministic scoring criterion applied to an evaluation subject. */
export type EvaluationCriterionType =
  | "must_succeed"
  | "max_latency"
  | "no_fallback"
  | "output_equals"
  | "output_contains";

export interface EvaluationCriterion {
  type: EvaluationCriterionType;
  /** Threshold (max_latency) or expected text (output_equals/contains). */
  value?: string | number;
}

/** Expected properties for a subject (deterministic fixtures, no randomness). */
export interface EvaluationExpectation {
  outputEquals?: string;
  outputContains?: string;
  maxLatencyMs?: number;
  noFallback?: boolean;
}

/** A completed execution to evaluate (built from canonical observations). */
export interface EvaluationSubject {
  subjectId: string;
  provider: string;
  model: string;
  workloadType: string;
  success: boolean;
  errorKind: string | null;
  latencyMs: number;
  response: string | null;
  fallbackOccurred: boolean;
  expected?: EvaluationExpectation;
}

export interface CriterionOutcome {
  type: EvaluationCriterionType;
  passed: boolean;
}

/** Canonical, immutable per-subject evaluation. Produced ONLY by the engine. */
export interface EvaluationResult {
  evaluationId: string;
  subjectId: string;
  provider: string;
  model: string;
  workloadType: string;
  passed: boolean;
  score: number; // fraction of criteria passed, 0..1
  criteria: CriterionOutcome[];
  observedAt: number;
}

/** Canonical, immutable aggregate over an evaluation run. */
export interface EvaluationReport {
  evaluationId: string;
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  averageScore: number;
  byProvider: Record<string, { passRate: number; averageScore: number }>;
  results: EvaluationResult[];
  observedAt: number;
}

export type EvaluationMode = "disabled" | "enabled";

export interface EvaluationPolicy {
  mode: EvaluationMode;
  /** The criteria applied to every subject (deterministic). */
  criteria: EvaluationCriterion[];
  eligibleProviders: string[];
  eligibleWorkloads: string[];
  maxSubjects: number;
}

export function defaultEvaluationPolicy(): EvaluationPolicy {
  return {
    mode: "disabled",
    criteria: [{ type: "must_succeed" }],
    eligibleProviders: [],
    eligibleWorkloads: [],
    maxSubjects: 1000,
  };
}

export class EvaluationPolicyStore {
  private policy: EvaluationPolicy;
  constructor(policy: EvaluationPolicy = defaultEvaluationPolicy()) {
    this.policy = deepFreeze(policy);
  }
  current(): EvaluationPolicy {
    return this.policy;
  }
  configure(policy: EvaluationPolicy): void {
    this.policy = deepFreeze(policy);
  }
}

export function evaluationEligible(policy: EvaluationPolicy, provider: string, workloadType: string): boolean {
  if (policy.eligibleProviders.length > 0 && !policy.eligibleProviders.includes(provider)) return false;
  if (policy.eligibleWorkloads.length > 0 && !policy.eligibleWorkloads.includes(workloadType)) return false;
  return true;
}
