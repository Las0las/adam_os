// L0 — representative live decisions for the audit/evidence lens.
//
// These are not fixtures: each entry runs the REAL root runtime over a
// representative context and summarizes the evidenced decision it produced. The
// audit lens renders these so an operator can see the constitution deciding —
// authorizing legitimate actions and denying anonymous/unscoped/unauthorized
// ones — with the evidence behind each outcome.

import { ConstitutionRuntime } from "./constitution-runtime";
import { summarizeDecision, type DecisionSummary } from "./projection";

export function liveSampleDecisions(): DecisionSummary[] {
  const tenant = "lawrence";
  return [
    summarizeDecision(
      "Recruiter creates a candidate (governed path)",
      ConstitutionRuntime.authorize({
        kind: "object.create",
        actor: { kind: "human", id: "user_recruiter_01", tenantId: tenant, permissions: ["candidate:create"] },
        enterpriseId: tenant,
        object: { objectType: "candidate", isMutation: false },
        audited: true,
      }),
    ),
    summarizeDecision(
      "System actor resolves a projection",
      ConstitutionRuntime.authorize({
        kind: "projection.resolve",
        actor: { kind: "system", id: null, tenantId: tenant, permissions: ["candidate:read"] },
        enterpriseId: tenant,
        projection: { objectType: "candidate", projectionId: "candidate.detail", surface: "fullPage" },
        audited: true,
      }),
    ),
    summarizeDecision(
      "Anonymous principal attempts a write",
      ConstitutionRuntime.authorize({
        kind: "object.create",
        actor: { kind: "anonymous", id: null, tenantId: tenant, permissions: [] },
        enterpriseId: tenant,
        object: { objectType: "candidate", isMutation: false },
        audited: true,
      }),
    ),
    summarizeDecision(
      "Write with no tenant scope",
      ConstitutionRuntime.authorize({
        kind: "object.update",
        actor: { kind: "human", id: "user_recruiter_01", tenantId: null, permissions: ["candidate:update"] },
        enterpriseId: "",
        object: { objectType: "candidate", isMutation: true },
        audited: true,
      }),
    ),
    summarizeDecision(
      "Write carrying no authority (empty permissions)",
      ConstitutionRuntime.authorize({
        kind: "object.create",
        actor: { kind: "human", id: "user_recruiter_01", tenantId: tenant, permissions: [] },
        enterpriseId: tenant,
        object: { objectType: "candidate", isMutation: false },
        audited: true,
      }),
    ),
    summarizeDecision(
      "Agent acts on an unaudited path",
      ConstitutionRuntime.authorize({
        kind: "intent.emit",
        actor: { kind: "agent", id: "agent_sourcing_01", tenantId: tenant, permissions: ["candidate:create"] },
        enterpriseId: tenant,
        object: { objectType: "candidate", isMutation: true },
        audited: false,
      }),
    ),
  ];
}
