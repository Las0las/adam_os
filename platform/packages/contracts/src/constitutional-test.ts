/**
 * RFC-PC0 Contract 8 — Constitutional Test Contract.
 *
 * The platform's invariants are themselves a frozen contract. Any kernel/runtime
 * implementation must satisfy these Constitutional Conformance Requirements (CCRs).
 * Phase 0 freezes the SHAPE of these tests and ships them as todos; phases that
 * implement the kernel/runtime must make them pass against the real implementation.
 */
import type { Result } from "./common.js";

/** The canonical CCR identifiers. The list is frozen; outcomes are non-negotiable. */
export type ConstitutionalRequirementId =
  | "CCR-001" // Mutation without Principal
  | "CCR-002" // Event Replay
  | "CCR-003" // Tenant Isolation
  | "CCR-004"; // Projection Refresh

export interface ConstitutionalRequirement {
  readonly id: ConstitutionalRequirementId;
  readonly title: string;
  /** Plain-language statement of the expected, non-negotiable outcome. */
  readonly expectation: string;
}

/** The outcome of checking one CCR against an implementation. */
export interface ConstitutionalCheck {
  readonly id: ConstitutionalRequirementId;
  readonly satisfied: boolean;
  readonly detail: string;
}

/**
 * A conformance suite any implementation can be run through. Phase 0 provides the
 * frozen requirement set; later phases provide a runner that returns real checks.
 */
export interface ConstitutionalTestContract {
  readonly requirements: readonly ConstitutionalRequirement[];
  run(): Promise<Result<readonly ConstitutionalCheck[]>>;
}

/**
 * The frozen requirement definitions. Exported as a `const` of literal data (not
 * behavior) so the test harness and docs share ONE source of truth.
 */
export const CONSTITUTIONAL_REQUIREMENTS: readonly ConstitutionalRequirement[] = [
  {
    id: "CCR-001",
    title: "Mutation without Principal",
    expectation: "Denied; no state change; no domain event; an audit record is produced.",
  },
  {
    id: "CCR-002",
    title: "Event Replay",
    expectation: "Replaying events yields the same object state, projection, and evidence links.",
  },
  {
    id: "CCR-003",
    title: "Tenant Isolation",
    expectation: "No cross-tenant reads or mutations are possible.",
  },
  {
    id: "CCR-004",
    title: "Projection Refresh",
    expectation: "Projection output equals the event history it is derived from.",
  },
] as const;
