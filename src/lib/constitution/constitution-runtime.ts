// L0 — Constitution runtime facade. The single entry point other layers call to
// read the ratified document or to enforce it against an action. Pure aside from
// throwing on violation; safe to call from client or server.

import { LAWRENCE_CONSTITUTION } from "./constitution";
import { evaluateConstitution } from "./invariant-engine";
import type {
  Constitution,
  ConstitutionContext,
  ConstitutionVerdict,
} from "./contracts";

/** Thrown when a blocking constitutional invariant is violated. */
export class ConstitutionViolationError extends Error {
  readonly verdict: ConstitutionVerdict;
  constructor(verdict: ConstitutionVerdict) {
    const reasons = verdict.violations.map((v) => `${v.invariantId}: ${v.rationale}`).join("; ");
    super(`Constitution violated — ${reasons}`);
    this.name = "ConstitutionViolationError";
    this.verdict = verdict;
  }
}

/** The ratified constitution (read-only). */
export function getConstitution(): Constitution {
  return LAWRENCE_CONSTITUTION;
}

/** Evaluate an action against the constitution; never throws. */
export function evaluate(ctx: ConstitutionContext): ConstitutionVerdict {
  return evaluateConstitution(LAWRENCE_CONSTITUTION, ctx);
}

/**
 * Fail-closed enforcement: throws ConstitutionViolationError when any blocking
 * invariant is violated. Advisory violations never throw. Returns the verdict so
 * callers may also surface advisories.
 */
export function assertCompliant(ctx: ConstitutionContext): ConstitutionVerdict {
  const verdict = evaluate(ctx);
  if (!verdict.compliant) throw new ConstitutionViolationError(verdict);
  return verdict;
}
