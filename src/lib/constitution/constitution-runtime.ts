// L0 — the Constitution Runtime: the ROOT RUNTIME of the platform.
//
// This is not a helper that other code optionally consults. It is the runtime
// from which every other runtime derives its execution authority. The pipeline
// is explicit:
//
//   resolve enterprise identity → resolve mission context → resolve actor
//   identity → resolve authority → resolve policies → evaluate invariants →
//   evaluate rights → evaluate responsibilities → produce ConstitutionDecision →
//   emit evidence → return execution authority
//
// Downstream runtimes (Identity, Governance, Projection, Workflow, surfaces)
// execute ONLY when they hold an `authorized` ConstitutionDecision. The decision
// is the execution-authority token: evidenced, attributable, versioned, and
// replayable.

import { LAWRENCE_CONSTITUTION } from "./constitution";
import { decide } from "./evaluation-engine";
import type {
  Constitution,
  ConstitutionContext,
  ConstitutionDecision,
} from "./contracts";

/** Thrown when the runtime denies an action (a blocking element failed). */
export class ConstitutionViolationError extends Error {
  readonly decision: ConstitutionDecision;
  constructor(decision: ConstitutionDecision) {
    const reasons = decision.violations.map((v) => `${v.ref}: ${v.rationale}`).join("; ");
    super(`Constitution denied [${decision.decisionId}] — ${reasons}`);
    this.name = "ConstitutionViolationError";
    this.decision = decision;
  }
}

/**
 * The root runtime. A singleton object so callers reference it as a runtime, not
 * a bag of functions. Pure aside from `assertAuthorized` throwing on denial.
 */
export const ConstitutionRuntime = {
  /** The ratified constitution this runtime executes (read-only). */
  constitution(): Constitution {
    return LAWRENCE_CONSTITUTION;
  },

  /**
   * Run the full constitutional pipeline and produce an evidenced decision.
   * Never throws — inspect `decision.authorized`.
   */
  authorize(ctx: ConstitutionContext): ConstitutionDecision {
    return decide(LAWRENCE_CONSTITUTION, ctx);
  },

  /**
   * Fail-closed gate: returns the decision when authorized, throws
   * ConstitutionViolationError when denied. Advisories never throw. This is what
   * a downstream runtime calls to obtain execution authority before mutating.
   */
  assertAuthorized(ctx: ConstitutionContext): ConstitutionDecision {
    const decision = decide(LAWRENCE_CONSTITUTION, ctx);
    if (!decision.authorized) throw new ConstitutionViolationError(decision);
    return decision;
  },
} as const;

// ── Backward-compatible convenience wrappers ────────────────────────────────
// Existing call sites and the read surface use these names. They now delegate to
// the root runtime so there is a single source of authorization truth.

/** The ratified constitution (read-only). */
export function getConstitution(): Constitution {
  return ConstitutionRuntime.constitution();
}

/** Evaluate an action against the constitution; never throws. */
export function evaluate(ctx: ConstitutionContext): ConstitutionDecision {
  return ConstitutionRuntime.authorize(ctx);
}

/** Fail-closed enforcement; throws ConstitutionViolationError on denial. */
export function assertCompliant(ctx: ConstitutionContext): ConstitutionDecision {
  return ConstitutionRuntime.assertAuthorized(ctx);
}
