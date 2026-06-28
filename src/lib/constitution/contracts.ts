// L0 — Enterprise Constitution contracts.
//
// The Constitution is the foundational, surface-independent layer that every
// layer above (Objects, Capabilities, Projection Runtime, Workspaces, Workflows,
// Intelligence, Command, Shell, Administration) must obey. It is declarative,
// serializable, and deterministic: it declares WHO the enterprise is (Identity),
// WHY it exists (Mission), WHAT it believes (Principles), WHO may expect what
// (Rights), WHO owes what (Responsibilities), the rules that can NEVER be
// violated (Invariants), and the named policies derived from them (Policies).
//
// Nothing here performs I/O. Invariants are pure predicates evaluated against a
// ConstitutionContext, so the identical document enforces on the client (for UX)
// and on the server (authoritative, fail-closed).

/** The canonical self-description of the enterprise the constitution governs. */
export interface EnterpriseIdentity {
  /** Stable identifier (maps to the platform tenantId). */
  id: string;
  /** Legal / display name. */
  name: string;
  /** One-line description of what the enterprise is. */
  descriptor: string;
  /** Operating jurisdictions (informational; drives no hidden behavior). */
  jurisdictions: string[];
  /** The constitution version this identity ratified. */
  ratifiedVersion: string;
}

/** Why the enterprise exists. Singular and stable. */
export interface Mission {
  statement: string;
  /** The outcomes the mission is measured by. */
  measures: string[];
}

/** A belief that shapes interpretation of every rule below it. */
export interface Principle {
  id: string;
  title: string;
  statement: string;
}

/** Something a class of actors is entitled to expect from the enterprise. */
export interface Right {
  id: string;
  /** Who holds the right (e.g. "every-actor", "candidate", "operator"). */
  holder: string;
  statement: string;
}

/** Something a class of actors owes to the enterprise or to others. */
export interface Responsibility {
  id: string;
  /** Who bears the responsibility. */
  bearer: string;
  statement: string;
}

export type InvariantSeverity = "blocking" | "advisory";

/**
 * A rule that must hold for any governed action. `holds` is a PURE predicate:
 * given the action context it returns true when the invariant is satisfied. A
 * blocking invariant that does not hold denies the action (fail-closed).
 */
export interface Invariant {
  id: string;
  title: string;
  statement: string;
  severity: InvariantSeverity;
  /** The principle(s) this invariant operationalizes (traceability). */
  derivedFrom: string[];
  /** Pure, deterministic, side-effect-free. Returns true when satisfied. */
  holds(ctx: ConstitutionContext): boolean;
  /** Human-readable reason shown when the invariant is violated. */
  rationale: string;
}

/** A named, human-facing policy derived from one or more invariants. */
export interface Policy {
  id: string;
  title: string;
  statement: string;
  enforces: string[]; // invariant ids
}

/** The full constitutional document. Deep-frozen at module load. */
export interface Constitution {
  version: string;
  identity: EnterpriseIdentity;
  mission: Mission;
  principles: Principle[];
  rights: Right[];
  responsibilities: Responsibility[];
  invariants: Invariant[];
  policies: Policy[];
}

// ── Evaluation surface ──────────────────────────────────────────────────────

/** The kind of governed action being evaluated against the constitution. */
export type ConstitutionActionKind =
  | "object.create"
  | "object.update"
  | "object.delete"
  | "intent.emit"
  | "workflow.transition"
  | "read";

/**
 * The minimal, surface-independent context every invariant evaluates against.
 * Built once at the governance entry point and passed unchanged to every
 * invariant so evaluation is deterministic and order-independent.
 */
export interface ConstitutionContext {
  kind: ConstitutionActionKind;
  /** The resolved identity performing the action (never anonymous for writes). */
  actor: {
    /**
     * The kind of resolved principal. A `user` carries a user id; a `system`
     * (machine/service) actor is resolved and tenant-scoped but has no user id;
     * `anonymous` means no principal was resolved at all (always denied for
     * writes).
     */
    kind: "user" | "system" | "anonymous";
    id: string | null;
    tenantId: string | null;
    permissions: string[];
  };
  /** The enterprise the action is scoped to. */
  enterpriseId: string;
  /** Optional object dimensions when the action touches an object. */
  object?: {
    objectType?: string;
    /** True when the write would mutate an existing record. */
    isMutation?: boolean;
  };
  /** Whether the action is carried out under an audited path. */
  audited: boolean;
  /** Arbitrary payload for invariant-specific checks (read-only). */
  payload?: Record<string, unknown>;
}

export interface InvariantViolation {
  invariantId: string;
  title: string;
  severity: InvariantSeverity;
  rationale: string;
}

export interface ConstitutionVerdict {
  /** True when no BLOCKING invariant was violated. */
  compliant: boolean;
  violations: InvariantViolation[];
  /** Advisory (non-blocking) violations, surfaced but not denied. */
  advisories: InvariantViolation[];
  evaluatedInvariants: number;
}
