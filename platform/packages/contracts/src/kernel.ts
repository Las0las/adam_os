/**
 * RFC-K0 — Kernel interface (frozen here; implemented in @lawrence/kernel, Phase 1).
 *
 * The Kernel is deliberately SMALL. It does exactly eight things and nothing else.
 * Everything else (storage, AI, search, projections, registries...) lives in Host
 * Services, Registries, or Runtimes. Keeping the Kernel tiny is what keeps it from
 * becoming "an enterprise framework".
 */
import type {
  DecisionId,
  Iso8601,
  Principal,
  PrincipalId,
  Result,
  TenantContext,
} from "./common.js";
import type { Decision } from "./decision.js";
import type { DomainEvent, Mutation, ReversalPlan } from "./mutation.js";
import type { AuthorityGrant, PolicyEvaluation } from "./policy.js";

/**
 * The eight — and ONLY eight — Kernel responsibilities. Each is pure with respect
 * to its inputs; side effects are delegated to Host Services behind these results.
 */
export interface KernelContract {
  /** 1. Resolve Principal — who is acting (or none). */
  resolvePrincipal(token: string, ctx: TenantContext): Promise<Result<Principal>>;

  /** 2. Resolve Authority — what this principal is permitted to attempt. */
  resolveAuthority(principal: Principal, mutation: Mutation): Promise<Result<AuthorityGrant>>;

  /** 3. Evaluate Policy — apply constitutional + domain policy gates (fail-closed). */
  evaluatePolicy(
    principal: Principal,
    mutation: Mutation,
    authority: AuthorityGrant,
  ): Promise<Result<PolicyEvaluation>>;

  /** 4. Validate Mutation — shape, identity, concurrency, and idempotency checks. */
  validateMutation(mutation: Mutation): Promise<Result<void>>;

  /** 5. Produce Decision — the single governed verdict (grant or deny, with reasons). */
  produceDecision(mutation: Mutation, evaluation: PolicyEvaluation): Promise<Result<Decision>>;

  /** 6. Produce Event — on grant, the immutable append-only DomainEvent. */
  produceEvent(decision: Decision): Promise<Result<DomainEvent>>;

  /** 7. Guarantee Audit — every decision (grant OR deny) yields a durable audit record. */
  guaranteeAudit(decision: Decision): Promise<Result<AuditRecord>>;

  /** 8. Guarantee Reversibility — every applied event has a compensating reversal. */
  guaranteeReversibility(event: DomainEvent): Promise<Result<ReversalPlan>>;
}

/** Canonical alias — the Kernel as referenced throughout the platform. */
export type Kernel = KernelContract;

/** A durable, immutable record that a decision was made — produced even on denial. */
export interface AuditRecord {
  readonly decisionId: DecisionId;
  readonly principalId: PrincipalId | null;
  readonly outcome: "granted" | "denied";
  readonly reasonCodes: readonly string[];
  readonly recordedAt: Iso8601;
}

/** A read query against the append-only audit log (kernel responsibility #7). */
export interface AuditQuery {
  readonly principalId?: PrincipalId;
  readonly decisionId?: DecisionId;
  readonly outcome?: "granted" | "denied";
  readonly since?: Iso8601;
  readonly until?: Iso8601;
}
