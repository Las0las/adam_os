/**
 * @lawrence/kernel — the real governed Kernel (Phase 1).
 *
 * Implements the eight (and only eight) responsibilities frozen in RFC-K0. The
 * kernel is deny-by-default and fail-closed: an unresolved principal, a tenant
 * mismatch, or an unknown gate result blocks the mutation and STILL produces an
 * audit record. State changes flow exclusively through produceEvent, onto the
 * append-only hash-chained log. Everything outside these eight methods (storage,
 * AI, search, projection...) lives in Host Services or Runtimes — not here.
 */
import type {
  AuditRecord,
  AuthorityGrant,
  Decision,
  DomainEvent,
  Iso8601,
  Kernel,
  Mutation,
  MutationId,
  PolicyEvaluation,
  PolicyGateResult,
  Principal,
  ReversalPlan,
  Result,
  TenantContext,
} from "@lawrence/contracts";

import { EventLog, inverseChanges } from "./internal/event-log.js";
import type { ObjectState } from "./internal/event-log.js";
import { mintDecisionId } from "./internal/hashing.js";
import { AuditLedger } from "./internal/ledger-store.js";
import { PrincipalRegistry } from "./internal/principal-registry.js";
import type { SeedPrincipal } from "./internal/principal-registry.js";

const VALID_OPERATIONS = new Set(["create", "update", "archive", "restore"]);

/** Risk tier assigned per operation; agents are bumped one tier (more scrutiny). */
function riskTierFor(mutation: Mutation, principal: Principal): 0 | 1 | 2 | 3 | 4 {
  const base = mutation.operation === "archive" ? 3 : mutation.operation === "restore" ? 2 : 1;
  const bumped = principal.kind === "agent" ? base + 1 : base;
  return Math.min(bumped, 4) as 0 | 1 | 2 | 3 | 4;
}

function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}
function err<T>(code: string, message: string, details?: Record<string, unknown>): Result<T> {
  return { ok: false, error: details ? { code, message, details } : { code, message } };
}

export interface KernelOptions {
  /** Deterministic clock for tests; defaults to wall-clock ISO-8601. */
  readonly now?: () => string;
  /** Principals known to the kernel (token -> principal). */
  readonly principals?: readonly SeedPrincipal[];
}

export class LawrenceKernel implements Kernel {
  private readonly events = new EventLog();
  private readonly audit = new AuditLedger();
  private readonly principals: PrincipalRegistry;
  private readonly now: () => string;
  /** Mutations captured at decision time so produceEvent can apply them. */
  private readonly pending = new Map<MutationId, Mutation>();

  constructor(options: KernelOptions = {}) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.principals = new PrincipalRegistry(options.principals ?? []);
  }

  /** Register a principal after construction (e.g. from the Authentication host service). */
  registerPrincipal(seed: SeedPrincipal): void {
    this.principals.seed(seed);
  }

  // ── 1. Resolve Principal ───────────────────────────────────────────────────
  async resolvePrincipal(token: string, ctx: TenantContext): Promise<Result<Principal>> {
    const principal = this.principals.resolve(token, ctx);
    if (!principal) {
      return err("NO_PRINCIPAL", "Token did not resolve to a principal in this tenant.");
    }
    return ok(principal);
  }

  // ── 2. Resolve Authority ─────────────────────────────────────────────────────
  async resolveAuthority(
    principal: Principal,
    mutation: Mutation,
  ): Promise<Result<AuthorityGrant>> {
    // Grants follow the convention `mutate:<op>` or `mutate:*`.
    const allowed = new Set<string>();
    for (const grant of principal.grants) {
      if (grant === "mutate:*") {
        for (const op of VALID_OPERATIONS) allowed.add(op);
      } else if (grant.startsWith("mutate:")) {
        allowed.add(grant.slice("mutate:".length));
      }
    }
    return ok({
      principalId: principal.id,
      allowed: [...allowed],
      riskTier: riskTierFor(mutation, principal),
    });
  }

  // ── 3. Evaluate Policy (fail-closed gates) ───────────────────────────────────
  async evaluatePolicy(
    principal: Principal,
    mutation: Mutation,
    authority: AuthorityGrant,
  ): Promise<Result<PolicyEvaluation>> {
    const gates: PolicyGateResult[] = [];

    // CCR-001 — every governed effect must be attributable to a real principal.
    const principalBound =
      !!mutation.principalId &&
      mutation.principalId === principal.id &&
      this.principals.has(principal.tenantId, principal.id);
    gates.push({
      gateId: "principal-bound",
      passed: principalBound,
      reasonCode: principalBound ? "PRINCIPAL_OK" : "PRINCIPAL_MISSING",
    });

    // CCR-003 — the principal and the mutation must share a tenant.
    const sameTenant = principal.tenantId === mutation.tenantId;
    gates.push({
      gateId: "tenant-isolation",
      passed: sameTenant,
      reasonCode: sameTenant ? "TENANT_OK" : "TENANT_MISMATCH",
    });

    // Authority — the operation must be within the resolved grant.
    const operationAllowed = authority.allowed.includes(mutation.operation);
    gates.push({
      gateId: "authority-grant",
      passed: operationAllowed,
      reasonCode: operationAllowed ? "AUTHORITY_OK" : "AUTHORITY_DENIED",
    });

    // High-risk attempts pass the gate but route to human approval (tier >= 3).
    const highRisk = authority.riskTier >= 3;
    gates.push({
      gateId: "risk-tier",
      passed: true,
      reasonCode: highRisk ? "RISK_HIGH" : "RISK_OK",
      requiresHumanApproval: highRisk,
    });

    const allPassed = gates.every((g) => g.passed);
    const requiresHumanApproval = gates.some((g) => g.requiresHumanApproval === true);
    return ok({ gates, allPassed, requiresHumanApproval });
  }

  // ── 4. Validate Mutation (shape / identity / concurrency / idempotency) ──────
  async validateMutation(mutation: Mutation): Promise<Result<void>> {
    if (!mutation.id) return err("INVALID_MUTATION", "Mutation id is required.");
    if (!mutation.tenantId) return err("INVALID_MUTATION", "Mutation tenantId is required.");
    if (!mutation.objectId) return err("INVALID_MUTATION", "Mutation objectId is required.");
    if (!mutation.objectTypeId) return err("INVALID_MUTATION", "objectTypeId is required.");
    if (!VALID_OPERATIONS.has(mutation.operation)) {
      return err("INVALID_MUTATION", `Unknown operation: ${String(mutation.operation)}`);
    }
    if (!Array.isArray(mutation.changes)) {
      return err("INVALID_MUTATION", "changes must be an array.");
    }
    if (
      (mutation.operation === "create" || mutation.operation === "update") &&
      mutation.changes.length === 0
    ) {
      return err("INVALID_MUTATION", `${mutation.operation} requires at least one change.`);
    }
    if (!mutation.idempotencyKey) {
      return err("INVALID_MUTATION", "idempotencyKey is required.");
    }
    // Optimistic concurrency: if the caller stated an expected revision, it must match.
    if (mutation.expectedRevision !== undefined) {
      const current = this.events.objectRevision(mutation.tenantId, mutation.objectId);
      if (current !== mutation.expectedRevision) {
        return err("CONCURRENCY_CONFLICT", "Object revision has moved on.", {
          expected: mutation.expectedRevision,
          actual: current,
        });
      }
    }
    return ok(undefined);
  }

  // ── 5. Produce Decision (the single governed verdict) ────────────────────────
  async produceDecision(
    mutation: Mutation,
    evaluation: PolicyEvaluation,
  ): Promise<Result<Decision>> {
    const outcome: Decision["outcome"] = !evaluation.allPassed
      ? "denied"
      : evaluation.requiresHumanApproval
        ? "pending_approval"
        : "granted";
    const decidedAt = this.now() as Iso8601;
    const decision: Decision = {
      id: mintDecisionId(mutation.id, decidedAt),
      forMutation: mutation.id,
      principalId: mutation.principalId || null,
      outcome,
      evaluation,
      reasonCodes: evaluation.gates.filter((g) => !g.passed).map((g) => g.reasonCode),
      evidence: [],
      decidedAt,
    };
    // Capture the mutation so produceEvent can apply it on grant.
    this.pending.set(mutation.id, mutation);
    return ok(decision);
  }

  // ── 6. Produce Event (only on grant; append-only) ────────────────────────────
  async produceEvent(decision: Decision): Promise<Result<DomainEvent>> {
    if (decision.outcome !== "granted") {
      return err("NOT_GRANTED", `No event for a ${decision.outcome} decision.`);
    }
    const mutation = this.pending.get(decision.forMutation);
    if (!mutation) {
      return err("MUTATION_NOT_FOUND", "No mutation captured for this decision.");
    }
    const { event } = this.events.append(mutation, decision.decidedAt);
    return ok(event);
  }

  // ── 7. Guarantee Audit (every decision, grant OR deny) ───────────────────────
  async guaranteeAudit(decision: Decision): Promise<Result<AuditRecord>> {
    const record = this.audit.append({
      decisionId: decision.id,
      principalId: decision.principalId,
      outcome: decision.outcome === "granted" ? "granted" : "denied",
      reasonCodes:
        decision.reasonCodes.length > 0
          ? decision.reasonCodes
          : [decision.outcome.toUpperCase()],
      recordedAt: decision.decidedAt,
    });
    return ok(record);
  }

  // ── 8. Guarantee Reversibility (compensating inverse for an applied event) ───
  async guaranteeReversibility(event: DomainEvent): Promise<Result<ReversalPlan>> {
    const inverseOp: Mutation["operation"] =
      event.type === "object.created"
        ? "archive"
        : event.type === "object.archived"
          ? "restore"
          : event.type === "object.restored"
            ? "archive"
            : "update";
    const preImage = this.events.preImageFor(event.id) ?? {};
    const inverse: Mutation = {
      id: `${event.causedByMutation}~inverse` as MutationId,
      tenantId: event.tenantId,
      principalId: event.principalId,
      objectId: event.objectId,
      objectTypeId: event.objectTypeId,
      operation: inverseOp,
      changes: inverseOp === "update" ? inverseChanges(event.changes, preImage) : [],
      idempotencyKey: event.hash,
      requestedAt: this.now() as Iso8601,
    };
    return ok({ forEvent: event.id, inverse });
  }

  // ── Governed read surfaces (queries, not extra authority) ────────────────────

  /** Query the append-only audit ledger. */
  auditLog(filter: Parameters<AuditLedger["query"]>[0] = {}): readonly AuditRecord[] {
    return this.audit.query(filter);
  }

  /** Tenant-scoped event history (never returns another tenant's events). */
  eventsFor(tenantId: TenantContext["tenantId"]): readonly DomainEvent[] {
    return this.events.eventsFor(tenantId);
  }

  /** Live folded state for one object. */
  objectState(
    tenantId: TenantContext["tenantId"],
    objectId: Mutation["objectId"],
  ): ObjectState {
    return this.events.objectState(tenantId, objectId);
  }
}

/** Construct an isolated, governed kernel instance. Internals stay private. */
export function createKernel(options: KernelOptions = {}): LawrenceKernel {
  return new LawrenceKernel(options);
}
