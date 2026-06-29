/**
 * Conformance suite for the real governed Kernel (Phase 1).
 *
 * Proves the eight RFC-K0 responsibilities AND the four Constitutional Conformance
 * Requirements (CCR-001..004) against the ACTUAL kernel — not a mock. Where a CCR
 * is fully owned by a later runtime (e.g. CCR-004 projection refresh belongs to the
 * Projection Runtime in Phase 4), we assert the kernel-layer instance of it.
 */
import { describe, expect, it } from "vitest";

import type {
  ContentHash,
  DomainEvent,
  Iso8601,
  Kernel,
  Mutation,
  MutationId,
  ObjectId,
  ObjectTypeId,
  PrincipalId,
  PropertyChange,
  Sequence,
  TenantContext,
  TenantId,
} from "@lawrence/contracts";

import { KERNEL_PUBLIC_API, createKernel } from "../index.js";
import type { SeedPrincipal } from "../index.js";

// ── Builders ─────────────────────────────────────────────────────────────────

const T1 = "tenant-1" as TenantId;
const T2 = "tenant-2" as TenantId;

function principal(over: Partial<SeedPrincipal> = {}): SeedPrincipal {
  return {
    token: "tok-p1",
    id: "p1" as PrincipalId,
    tenantId: T1,
    kind: "human",
    displayName: "Ada",
    grants: ["mutate:*"],
    ...over,
  };
}

let idem = 0;
function mutation(over: Partial<Mutation> = {}): Mutation {
  idem += 1;
  const changes: PropertyChange[] = [
    { key: "name", value: "Grace", provenance: "typed", confidence: 1 },
  ];
  return {
    id: `mut-${idem}` as MutationId,
    tenantId: T1,
    principalId: "p1" as PrincipalId,
    objectId: "obj-1" as ObjectId,
    objectTypeId: "candidate" as ObjectTypeId,
    operation: "create",
    changes,
    idempotencyKey: `idem-${idem}` as ContentHash,
    requestedAt: "2026-01-01T00:00:00.000Z" as Iso8601,
    ...over,
  };
}

function makeKernel(seed: readonly SeedPrincipal[] = [principal()]) {
  return createKernel({ now: () => "2026-01-01T00:00:00.000Z", principals: seed });
}

/** Run the full governed pipeline, returning every intermediate artifact. */
async function governed(k: ReturnType<typeof makeKernel>, token: string, m: Mutation) {
  const ctx: TenantContext = { tenantId: m.tenantId };
  const principalRes = await k.resolvePrincipal(token, ctx);
  if (!principalRes.ok) return { denied: "principal" as const, principalRes };
  const authority = await k.resolveAuthority(principalRes.value, m);
  const valid = await k.validateMutation(m);
  if (!valid.ok) return { denied: "validate" as const, valid };
  if (!authority.ok) return { denied: "authority" as const };
  const evaluation = await k.evaluatePolicy(principalRes.value, m, authority.value);
  if (!evaluation.ok) return { denied: "evaluate" as const };
  const decision = await k.produceDecision(m, evaluation.value);
  if (!decision.ok) return { denied: "decision" as const };
  const event = await k.produceEvent(decision.value);
  const audit = await k.guaranteeAudit(decision.value);
  return { denied: false as const, decision: decision.value, event, audit };
}

// ── The eight responsibilities ────────────────────────────────────────────────

describe("RFC-K0 — the eight kernel responsibilities", () => {
  it("exposes exactly the eight methods on the instance", () => {
    const k = makeKernel();
    expect(KERNEL_PUBLIC_API).toHaveLength(8);
    for (const method of KERNEL_PUBLIC_API) {
      expect(typeof (k as unknown as Record<string, unknown>)[method]).toBe("function");
    }
  });

  it("implements the frozen Kernel contract type", () => {
    const k: Kernel = createKernel();
    expect(k).toBeDefined();
  });

  it("grants a well-formed mutation end to end and applies one event", async () => {
    const k = makeKernel();
    const res = await governed(k, "tok-p1", mutation());
    expect(res.denied).toBe(false);
    if (res.denied !== false) return;

    expect(res.decision.outcome).toBe("granted");
    expect(res.event.ok).toBe(true);
    const event = (res.event as { ok: true; value: DomainEvent }).value;
    expect(event.sequence).toBe(1);
    expect(event.previousHash).toBeNull();
    expect(event.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(event.type).toBe("object.created");

    expect(res.audit.ok).toBe(true);
    const audit = (res.audit as { ok: true; value: { outcome: string } }).value;
    expect(audit.outcome).toBe("granted");

    expect(k.objectState(T1, "obj-1" as ObjectId).values).toEqual({ name: "Grace" });
  });

  it("guarantees a compensating reversal for an applied event", async () => {
    const k = makeKernel();
    const res = await governed(k, "tok-p1", mutation());
    if (res.denied !== false || !res.event.ok) throw new Error("expected grant");
    const reversal = await k.guaranteeReversibility(res.event.value);
    expect(reversal.ok).toBe(true);
    const plan = (reversal as { ok: true; value: { inverse: Mutation } }).value;
    // The inverse of a create is an archive.
    expect(plan.inverse.operation).toBe("archive");
    expect(plan.inverse.objectId).toBe("obj-1");
  });

  it("chains event hashes across sequential mutations", async () => {
    const k = makeKernel();
    const a = await governed(k, "tok-p1", mutation());
    const b = await governed(
      k,
      "tok-p1",
      mutation({ operation: "update", changes: [{ key: "name", value: "Grace H.", provenance: "typed", confidence: 1 }] }),
    );
    if (a.denied !== false || !a.event.ok || b.denied !== false || !b.event.ok) {
      throw new Error("expected two grants");
    }
    expect(b.event.value.previousHash).toBe(a.event.value.hash);
    expect(b.event.value.sequence).toBe(2);
    expect(k.objectState(T1, "obj-1" as ObjectId).values).toEqual({ name: "Grace H." });
  });
});

// ── Constitutional Conformance Requirements ───────────────────────────────────

describe("CCR-001 — Mutation without Principal", () => {
  it("denies, applies no event, but still produces an audit record", async () => {
    const k = makeKernel();
    // A mutation that names no principal (empty id) — must be denied.
    const res = await governed(k, "tok-p1", mutation({ principalId: "" as PrincipalId }));
    if (res.denied !== false) throw new Error("pipeline should reach a decision");
    expect(res.decision.outcome).toBe("denied");
    expect((res.event as { ok: boolean }).ok).toBe(false); // no event
    expect(k.eventsFor(T1)).toHaveLength(0); // no state change
    const audit = (res.audit as { ok: true; value: { outcome: string } }).value;
    expect(audit.outcome).toBe("denied"); // audit still produced
    expect(k.auditLog({ outcome: "denied" })).toHaveLength(1);
  });

  it("denies an unknown token at principal resolution", async () => {
    const k = makeKernel();
    const res = await k.resolvePrincipal("bogus", { tenantId: T1 });
    expect(res.ok).toBe(false);
  });
});

describe("CCR-002 — Event Replay (determinism / replay equivalence)", () => {
  it("two kernels fed the same mutations yield identical events and state", async () => {
    const seed = [principal()];
    const ops: Mutation[] = [
      mutation({ id: "m-a" as MutationId, idempotencyKey: "k-a" as ContentHash }),
      mutation({
        id: "m-b" as MutationId,
        idempotencyKey: "k-b" as ContentHash,
        operation: "update",
        changes: [{ key: "stage", value: "screen", provenance: "typed", confidence: 1 }],
      }),
    ];
    const kA = makeKernel(seed);
    const kB = makeKernel(seed);
    for (const m of ops) {
      await governed(kA, "tok-p1", m);
      await governed(kB, "tok-p1", m);
    }
    const hashesA = kA.eventsFor(T1).map((e) => e.hash);
    const hashesB = kB.eventsFor(T1).map((e) => e.hash);
    expect(hashesA).toEqual(hashesB);
    expect(kA.objectState(T1, "obj-1" as ObjectId)).toEqual(
      kB.objectState(T1, "obj-1" as ObjectId),
    );
  });

  it("is idempotent — the same mutation never applies twice", async () => {
    const k = makeKernel();
    const m = mutation({ id: "m-x" as MutationId, idempotencyKey: "k-x" as ContentHash });
    const first = await governed(k, "tok-p1", m);
    const second = await governed(k, "tok-p1", m);
    if (first.denied !== false || !first.event.ok) throw new Error("expected grant");
    if (second.denied !== false || !second.event.ok) throw new Error("expected grant");
    expect(k.eventsFor(T1)).toHaveLength(1);
    // Same event returned, not a duplicate.
    expect(second.event.value.id).toBe(first.event.value.id);
  });
});

describe("CCR-003 — Tenant Isolation", () => {
  it("does not resolve a principal outside its tenant", async () => {
    const k = makeKernel();
    const res = await k.resolvePrincipal("tok-p1", { tenantId: T2 });
    expect(res.ok).toBe(false);
  });

  it("denies a mutation whose tenant differs from the principal's", async () => {
    const k = makeKernel();
    const p = await k.resolvePrincipal("tok-p1", { tenantId: T1 });
    if (!p.ok) throw new Error("principal");
    const crossTenant = mutation({ tenantId: T2 });
    const auth = await k.resolveAuthority(p.value, crossTenant);
    if (!auth.ok) throw new Error("auth");
    const evalR = await k.evaluatePolicy(p.value, crossTenant, auth.value);
    if (!evalR.ok) throw new Error("eval");
    const gate = evalR.value.gates.find((g) => g.gateId === "tenant-isolation");
    expect(gate?.passed).toBe(false);
    expect(evalR.value.allPassed).toBe(false);
  });

  it("never returns another tenant's events", async () => {
    const k = makeKernel([
      principal(),
      principal({ token: "tok-p2", id: "p2" as PrincipalId, tenantId: T2 }),
    ]);
    await governed(k, "tok-p1", mutation());
    await governed(
      k,
      "tok-p2",
      mutation({ tenantId: T2, principalId: "p2" as PrincipalId, objectId: "obj-2" as ObjectId }),
    );
    expect(k.eventsFor(T1).every((e) => e.tenantId === T1)).toBe(true);
    expect(k.eventsFor(T1)).toHaveLength(1);
    expect(k.eventsFor(T2)).toHaveLength(1);
  });
});

describe("CCR-004 — Projection/state refresh equals event history", () => {
  it("the kernel's folded object state equals an independent fold of its events", async () => {
    const k = makeKernel();
    await governed(k, "tok-p1", mutation());
    await governed(
      k,
      "tok-p1",
      mutation({
        operation: "update",
        changes: [
          { key: "name", value: "Grace M. Hopper", provenance: "typed", confidence: 1 },
          { key: "stage", value: "offer", provenance: "typed", confidence: 1 },
        ],
      }),
    );

    // Independent re-derivation from the public event history.
    const rederived: Record<string, unknown> = {};
    for (const e of [...k.eventsFor(T1)].sort((x, y) => x.sequence - y.sequence)) {
      for (const c of e.changes) rederived[c.key] = c.value;
    }
    expect(k.objectState(T1, "obj-1" as ObjectId).values).toEqual(rederived);
  });
});

describe("Governance edge cases", () => {
  it("rejects an optimistic-concurrency conflict at validation", async () => {
    const k = makeKernel();
    await governed(k, "tok-p1", mutation()); // object now at revision 1
    const stale = mutation({ operation: "update", expectedRevision: 0 as Sequence });
    const valid = await k.validateMutation(stale);
    expect(valid.ok).toBe(false);
  });

  it("routes a high-risk archive to human approval (no event yet)", async () => {
    const k = makeKernel();
    await governed(k, "tok-p1", mutation()); // create obj-1
    const res = await governed(k, "tok-p1", mutation({ operation: "archive", changes: [] }));
    if (res.denied !== false) throw new Error("pipeline should decide");
    expect(res.decision.outcome).toBe("pending_approval");
    expect((res.event as { ok: boolean }).ok).toBe(false);
    // Still only the create event applied.
    expect(k.eventsFor(T1)).toHaveLength(1);
  });
});
