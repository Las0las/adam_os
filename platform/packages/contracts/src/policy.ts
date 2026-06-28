/**
 * Authority + Policy types consumed by the Kernel. These describe the INPUTS to a
 * governed decision: what a principal is allowed to attempt, and how policy gates
 * evaluate a specific mutation. Implementations live in the Kernel/policy runtime.
 */
import type { PrincipalId } from "./common.js";

/** The resolved permission envelope for a principal against a specific mutation. */
export interface AuthorityGrant {
  readonly principalId: PrincipalId;
  /** Permitted operations resolved from grants/roles. */
  readonly allowed: readonly string[];
  /** Risk tier 0..4 assigned to this attempt (drives human-approval routing). */
  readonly riskTier: 0 | 1 | 2 | 3 | 4;
}

/** A single named policy gate result. Gates are fail-closed: unknown = blocked. */
export interface PolicyGateResult {
  readonly gateId: string;
  readonly passed: boolean;
  readonly reasonCode: string;
  readonly requiresHumanApproval?: boolean;
}

/** The aggregate evaluation of every gate that applied to a mutation. */
export interface PolicyEvaluation {
  readonly gates: readonly PolicyGateResult[];
  /** True only if every applicable gate passed. */
  readonly allPassed: boolean;
  /** True if at least one gate routes the mutation to human approval. */
  readonly requiresHumanApproval: boolean;
}
