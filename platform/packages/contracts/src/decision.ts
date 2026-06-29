/**
 * The Decision — the single governed verdict the Kernel produces for a mutation.
 * Exactly one authority owns a decision; surfaces provide evidence, never verdicts.
 */
import type {
  DecisionId,
  EvidenceRef,
  Iso8601,
  MutationId,
  PrincipalId,
} from "./common.js";
import type { PolicyEvaluation } from "./policy.js";

export type DecisionOutcome = "granted" | "denied" | "pending_approval";

export interface Decision {
  readonly id: DecisionId;
  readonly forMutation: MutationId;
  readonly principalId: PrincipalId | null;
  readonly outcome: DecisionOutcome;
  readonly evaluation: PolicyEvaluation;
  readonly reasonCodes: readonly string[];
  readonly evidence: readonly EvidenceRef[];
  readonly decidedAt: Iso8601;
}
