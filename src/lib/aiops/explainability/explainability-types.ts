// IOS-015 — Explainability Engine (per AS-001) — types + policy.
//
// A PURELY OBSERVATIONAL subsystem: a subscriber on the Execution Event Bus
// (IOS-005) that correlates the events of a single execution into an immutable
// Explanation — why routing selected the target, which middleware acted (security,
// cache, retry, circuit, fallback), and the outcome. It reads the canonical
// platform objects (RoutingDecision / ExecutionPlan carried on the execution
// event; the IOS-013 ProviderHealth store by reference) WITHOUT extending or
// mutating them. It performs no routing, invokes no providers, and changes no
// execution behavior. Governed by immutable ExplainabilityPolicy; default DISABLED.

import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import type { ExecutionTarget } from "@/lib/aiops/routing/routing-types";

export interface RoutingExplanation {
  selectedProvider: string | null;
  selectedModel: string | null;
  /** The authorized Execution Plan targets (ADR-0004), primary first. */
  planTargets: ExecutionTarget[];
  evaluatedProviders: string[];
  rejections: Array<{ provider: string; model: string; reason: string }>;
}

export interface SecurityExplanation {
  inspected: boolean;
  promptOutcome: "allowed" | "flagged" | "rejected" | null;
  piiDetected: boolean;
  piiMasked: boolean;
  validation: "succeeded" | "failed" | null;
}

export interface RetryExplanation {
  attempts: number;
  outcome: "succeeded" | "exhausted" | null;
}

export interface FallbackExplanation {
  occurred: boolean;
  target: ExecutionTarget | null;
}

export interface OutcomeExplanation {
  success: boolean;
  errorKind: string | null;
  latencyMs: number;
}

/** An immutable, structured account of one execution. Frozen on production. */
export interface Explanation {
  executionId: string;
  requestId: string;
  tenantId: string | null;
  provider: string;
  model: string;
  workloadType: string;
  timestamp: number;
  routing: RoutingExplanation;
  security: SecurityExplanation;
  cache: { lookedUp: boolean; hit: boolean };
  retry: RetryExplanation;
  circuit: { state: string; rejected: boolean };
  fallback: FallbackExplanation;
  /** Reference (provider|model key) into the IOS-013 ProviderHealth store. */
  healthRef: string;
  outcome: OutcomeExplanation;
}

export type ExplainabilityMode = "disabled" | "enabled";

export interface ExplainabilityPolicy {
  mode: ExplainabilityMode;
  eligibleProviders: string[];
  eligibleWorkloads: string[];
  /** Maximum explanations retained in the in-memory store (bounded). */
  retain: number;
}

export function defaultExplainabilityPolicy(): ExplainabilityPolicy {
  return { mode: "disabled", eligibleProviders: [], eligibleWorkloads: [], retain: 100 };
}

export class ExplainabilityPolicyStore {
  private policy: ExplainabilityPolicy;
  constructor(policy: ExplainabilityPolicy = defaultExplainabilityPolicy()) {
    this.policy = deepFreeze(policy);
  }
  current(): ExplainabilityPolicy {
    return this.policy;
  }
  configure(policy: ExplainabilityPolicy): void {
    this.policy = deepFreeze(policy);
  }
}

export function explainabilityEligible(policy: ExplainabilityPolicy, provider: string, workloadType: string): boolean {
  if (policy.eligibleProviders.length > 0 && !policy.eligibleProviders.includes(provider)) return false;
  if (policy.eligibleWorkloads.length > 0 && !policy.eligibleWorkloads.includes(workloadType)) return false;
  return true;
}
