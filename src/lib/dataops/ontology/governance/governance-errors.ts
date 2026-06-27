// VS-008 — typed error for an enforce-mode blocking governance decision.
import type { GovernanceDecision } from "./governance-types";

export class GovernanceDecisionError extends Error {
  readonly decision: GovernanceDecision;
  readonly codes: string[];

  constructor(decision: GovernanceDecision) {
    const codes = [...new Set(decision.blockingFindings.map((f) => f.code))].sort();
    super(
      `${decision.subjectType} ${decision.subjectId} blocked by governance: ${decision.blockingFindings.length} blocking finding(s) [${codes.join(", ")}]`,
    );
    this.name = "GovernanceDecisionError";
    this.decision = decision;
    this.codes = codes;
  }
}
