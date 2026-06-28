// L0 → VS-008 bridge. Surfaces the constitution's blocking invariants to the
// existing Governance Orchestrator as a single pluggable GovernancePolicy, so
// any subject the orchestrator evaluates (mission / workflow / import / api /
// agent / automation) is also checked against constitutional invariants. The
// constitution remains the source of truth; this only re-expresses it in the
// orchestrator's finding vocabulary.

import { registerGovernancePolicy } from "@/lib/dataops/ontology/governance/governance-policy-registry";
import type { GovernanceFinding, GovernancePolicyContext } from "@/lib/dataops/ontology/governance/governance-types";
import { evaluate } from "./constitution-runtime";
import type { ConstitutionActionKind } from "./contracts";

/** Map a governance subject to the closest constitutional action kind. */
function subjectToKind(subjectType: GovernancePolicyContext["subjectType"]): ConstitutionActionKind {
  switch (subjectType) {
    case "import":
      return "object.create";
    case "workflow":
      return "workflow.transition";
    default:
      // mission / api / agent / automation are governed action surfaces.
      return "intent.emit";
  }
}

export const CONSTITUTION_GOVERNANCE_POLICY_ID = "constitution.invariants";

let registered = false;

/** Register the constitutional-invariant policy once (idempotent). */
export function registerConstitutionGovernancePolicy(): void {
  if (registered) return;
  registered = true;

  registerGovernancePolicy({
    id: CONSTITUTION_GOVERNANCE_POLICY_ID,
    description:
      "Enforces the Enterprise Constitution's blocking invariants on every governed subject.",
    evaluate(input: GovernancePolicyContext): GovernanceFinding[] {
      const actorUserId = input.ctx.actorUserId ?? null;
      const decision = evaluate({
        kind: subjectToKind(input.subjectType),
        actor: {
          kind: actorUserId ? "human" : "system",
          id: actorUserId,
          tenantId: input.ctx.tenantId ?? null,
          permissions: (input.ctx.permissions ?? []) as string[],
        },
        enterpriseId: input.ctx.tenantId ?? "",
        audited: true, // the orchestrator path is audited
      });

      return [...decision.violations, ...decision.advisories].map((v) => ({
        stage: "policy" as const,
        code: v.ref,
        severity: v.severity === "blocking" ? ("error" as const) : ("warning" as const),
        message: `${v.title}: ${v.rationale}`,
      }));
    },
  });
}
