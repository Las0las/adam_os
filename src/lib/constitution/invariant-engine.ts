// L0 — pure invariant evaluation. Deterministic and side-effect-free so the
// SAME constitution enforces identically on the client (UX) and the server
// (authoritative). Fail-closed: a blocking invariant that throws or returns
// false denies the action.

import type {
  Constitution,
  ConstitutionContext,
  ConstitutionVerdict,
  InvariantViolation,
} from "./contracts";

export function evaluateConstitution(
  constitution: Constitution,
  ctx: ConstitutionContext,
): ConstitutionVerdict {
  const violations: InvariantViolation[] = [];
  const advisories: InvariantViolation[] = [];

  for (const inv of constitution.invariants) {
    let satisfied: boolean;
    try {
      satisfied = inv.holds(ctx) === true;
    } catch {
      // A throwing invariant is treated as a violation (fail-closed) rather than
      // silently passing.
      satisfied = false;
    }
    if (satisfied) continue;

    const violation: InvariantViolation = {
      invariantId: inv.id,
      title: inv.title,
      severity: inv.severity,
      rationale: inv.rationale,
    };
    if (inv.severity === "blocking") violations.push(violation);
    else advisories.push(violation);
  }

  return {
    compliant: violations.length === 0,
    violations,
    advisories,
    evaluatedInvariants: constitution.invariants.length,
  };
}
