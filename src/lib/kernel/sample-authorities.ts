// L0 kernel — representative live authority grants for the audit lens.
//
// Not fixtures: each entry submits a representative Intent to the REAL kernel,
// which authorizes it against the Constitution Runtime, mints an
// ExecutionAuthority, and records the grant/denial to the Execution Ledger. The
// audit lens renders these so an operator can see authority being ISSUED (and
// withheld) — and the ledger entries they produced.

import { Kernel } from "./kernel-runtime";
import type { ExecutionAuthority, Intent } from "./contracts";

/** A serializable summary of one issued authority, for the audit lens. */
export interface AuthoritySummary {
  authorityId: string;
  decisionId: string;
  scenario: string;
  outcome: ExecutionAuthority["outcome"];
  granted: boolean;
  actorKind: string;
  capabilities: string[];
  rights: string[];
  restrictions: string[];
  mission: string | null;
  expiresAt: string;
  signature: string;
}

function summarize(scenario: string, a: ExecutionAuthority): AuthoritySummary {
  return {
    authorityId: a.authorityId,
    decisionId: a.decisionId,
    scenario,
    outcome: a.outcome,
    granted: a.granted,
    actorKind: a.actor.kind,
    capabilities: a.capabilities,
    rights: a.rights,
    restrictions: a.restrictions,
    mission: a.mission?.title ?? null,
    expiresAt: a.expiresAt,
    signature: a.signature,
  };
}

/**
 * Run a representative set of intents through the kernel. The clock is fixed so
 * authority ids/signatures are deterministic across renders. Side effect: each
 * call appends grant/denial entries to the Execution Ledger.
 */
export function liveSampleAuthorities(now = Date.parse("2026-01-01T00:00:00.000Z")): AuthoritySummary[] {
  const tenant = "lawrence";
  const scenarios: { label: string; intent: Intent }[] = [
    {
      label: "Recruiter requests authority to create a candidate",
      intent: {
        kind: "object.create",
        actor: { kind: "human", id: "user_recruiter_01", tenantId: tenant, permissions: ["candidate:create"] },
        enterpriseId: tenant,
        object: { objectType: "candidate", isMutation: false },
        audited: true,
      },
    },
    {
      label: "AI agent requests authority to source a candidate",
      intent: {
        kind: "object.create",
        actor: { kind: "agent", id: "agent_sourcing_01", tenantId: tenant, permissions: ["candidate:create"] },
        enterpriseId: tenant,
        object: { objectType: "candidate", isMutation: false },
        audited: true,
      },
    },
    {
      label: "System resolves a projection",
      intent: {
        kind: "projection.resolve",
        actor: { kind: "system", id: null, tenantId: tenant, permissions: ["candidate:read"] },
        enterpriseId: tenant,
        projection: { objectType: "candidate", projectionId: "candidate.detail", surface: "fullPage" },
        audited: true,
      },
    },
    {
      label: "Anonymous principal requests write authority",
      intent: {
        kind: "object.create",
        actor: { kind: "anonymous", id: null, tenantId: tenant, permissions: [] },
        enterpriseId: tenant,
        object: { objectType: "candidate", isMutation: false },
        audited: true,
      },
    },
    {
      label: "Write request carrying no granted authority",
      intent: {
        kind: "object.update",
        actor: { kind: "human", id: "user_recruiter_01", tenantId: tenant, permissions: [] },
        enterpriseId: tenant,
        object: { objectType: "candidate", isMutation: true },
        audited: true,
      },
    },
  ];

  return scenarios.map((s) => summarize(s.label, Kernel.requestAuthority(s.intent, now)));
}
