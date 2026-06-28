// L0 — the ratified Enterprise Constitution for the LAWRENCE platform.
//
// This is the single authoritative document the Constitution Runtime executes.
// Every right, responsibility, policy and invariant is a PURE predicate over a
// ConstitutionContext, so the runtime authorizes fail-closed and identically on
// client and server. Editing this file changes what the entire platform is
// permitted to do — there is no other place rules of this rank live.

import type {
  Constitution,
  ConstitutionContext,
  EvidenceItem,
  PolicyEffect,
  PolicyEvaluation,
} from "./contracts";
import { RESOLVED_PRINCIPAL_KINDS } from "./contracts";

const CONSTITUTION_VERSION = "1.1.0";
const EFFECTIVE_DATE = "2026-06-27";

/** A write is any action that creates, updates, or deletes an object. */
function isWrite(ctx: ConstitutionContext): boolean {
  return (
    ctx.kind === "object.create" ||
    ctx.kind === "object.update" ||
    ctx.kind === "object.delete"
  );
}

function isResolved(ctx: ConstitutionContext): boolean {
  if (ctx.actor.kind === "human") return Boolean(ctx.actor.id && ctx.actor.id.length > 0);
  return RESOLVED_PRINCIPAL_KINDS.includes(ctx.actor.kind);
}

/** Small helper to assemble an executable policy from a pure decision function. */
function makePolicy(
  id: string,
  title: string,
  statement: string,
  enforces: string[],
  decide: (ctx: ConstitutionContext) => {
    effect: PolicyEffect;
    satisfied: boolean;
    explanation: string;
    evidence: EvidenceItem[];
    recommendation?: string;
  },
) {
  return {
    id,
    title,
    statement,
    enforces,
    evaluate(ctx: ConstitutionContext): PolicyEvaluation {
      const d = decide(ctx);
      return { policyId: id, ...d };
    },
  };
}

const constitution: Constitution = {
  version: CONSTITUTION_VERSION,
  effectiveDate: EFFECTIVE_DATE,

  amendments: [
    {
      version: "1.1.0",
      effectiveDate: EFFECTIVE_DATE,
      supersedes: "1.0.0",
      summary:
        "Elevated the Constitution from a module to the root runtime: richer principals, executable policies, mission objectives, and evidenced decisions.",
    },
    {
      version: "1.0.0",
      effectiveDate: "2026-06-26",
      supersedes: null,
      summary: "Genesis ratification: identity, mission, principles, rights, responsibilities, invariants.",
    },
  ],

  identity: {
    id: "lawrence",
    name: "LAWRENCE",
    descriptor:
      "A constitutional enterprise operating system where every surface is a projection of one canonical truth, and every action derives its authority from a single governing runtime.",
    jurisdictions: ["US"],
    ratifiedVersion: CONSTITUTION_VERSION,
  },

  mission: {
    statement:
      "Operate the enterprise from one canonical model of truth, so that every decision is grounded in evidence, governed by policy, and accountable to an identity.",
    measures: [
      "Every mutation is attributable to a resolved identity.",
      "Every governed action passes the same rules on the client and the server.",
      "No surface owns truth; surfaces only project it.",
    ],
    objectives: [
      {
        id: "OBJ-INTEGRITY",
        title: "Protect canonical integrity",
        statement:
          "Keep the canonical model correct and authoritative; never let a surface or cache become an independent source of truth.",
        priority: 1,
        successMetric: "Zero mutations that bypass the governed path.",
      },
      {
        id: "OBJ-ACCOUNTABILITY",
        title: "Make every action accountable",
        statement: "Every state change is attributable to an identity and carries its evidence.",
        priority: 2,
        successMetric: "100% of mutations carry an attributable, evidenced decision.",
      },
      {
        id: "OBJ-TRANSPARENCY",
        title: "Make every decision explainable",
        statement: "Anyone can see why an action was authorized or denied without reading code.",
        priority: 3,
        successMetric: "Every denial returns a specific constitutional reason.",
      },
    ],
  },

  principles: [
    {
      id: "P1",
      title: "One canonical truth",
      statement:
        "There is a single canonical model. Surfaces, projections, and caches derive from it and never become an independent source of truth.",
    },
    {
      id: "P2",
      title: "Identity precedes authority",
      statement:
        "No actor exercises authority without first being resolved to an identity scoped to an enterprise.",
    },
    {
      id: "P3",
      title: "Govern once, enforce everywhere",
      statement:
        "The rules that govern an action are declared once and enforced identically wherever the action can originate.",
    },
    {
      id: "P4",
      title: "Accountability is non-optional",
      statement:
        "Every state change is audited. An action that cannot be audited cannot be performed.",
    },
    {
      id: "P5",
      title: "Least authority",
      statement:
        "Actors receive the minimum authority required, and authority is checked at the moment of action, not assumed from context.",
    },
    {
      id: "P6",
      title: "Evidence over assertion",
      statement:
        "Decisions are justified by evidence carried with them, not by the confidence of the asserting party.",
    },
  ],

  rights: [
    {
      id: "R1",
      holder: "every-actor",
      statement: "To know which identity and authority an action was performed under.",
      rationale: "Every action must be attributable to a resolved principal.",
      honored: (ctx) => !isWrite(ctx) || isResolved(ctx),
    },
    {
      id: "R2",
      holder: "every-actor",
      statement: "To receive a clear, specific reason whenever an action is denied.",
      // Always honored structurally: the runtime always returns evidenced reasons.
      rationale: "Denials must carry a specific reason.",
      honored: () => true,
    },
    {
      id: "R3",
      holder: "subject-of-record",
      statement:
        "To have their record changed only through a governed, audited, attributable action.",
      rationale: "Records may change only via an audited, attributable path.",
      honored: (ctx) => !isWrite(ctx) || (ctx.audited === true && isResolved(ctx)),
    },
    {
      id: "R4",
      holder: "enterprise",
      statement: "To have its constitution enforced uniformly across every surface and integration.",
      rationale: "The constitution must apply to every action scope.",
      honored: (ctx) => ctx.enterpriseId.length > 0,
    },
  ],

  responsibilities: [
    {
      id: "D1",
      bearer: "every-actor",
      statement: "To act within granted authority and never to circumvent the governed path.",
      rationale: "Actors should carry only the authority they need.",
      met: (ctx) => !isWrite(ctx) || ctx.actor.permissions.length > 0,
    },
    {
      id: "D2",
      bearer: "every-surface",
      statement:
        "To route mutations through governed intents and never to write to the canonical model directly.",
      rationale: "Surfaces must mutate only through governed intents.",
      met: (ctx) => !isWrite(ctx) || ctx.audited === true,
    },
    {
      id: "D3",
      bearer: "the-runtime",
      statement:
        "To re-validate every action authoritatively on the server, treating client validation as convenience only.",
      rationale: "Object writes must name a canonical type so the server can re-validate.",
      met: (ctx) => !isWrite(ctx) || Boolean(ctx.object?.objectType),
    },
    {
      id: "D4",
      bearer: "the-enterprise",
      statement: "To keep the constitution legible and current, and to version every change to it.",
      rationale: "The constitution must remain versioned and legible.",
      met: () => true,
    },
  ],

  invariants: [
    {
      id: "INV-IDENTITY",
      title: "No anonymous mutation",
      statement:
        "Every write is bound to a resolved principal — never anonymous. Human principals carry a user id; system, agent, workflow, integration, service and automation principals are resolved and tenant-scoped.",
      severity: "blocking",
      derivedFrom: ["P2", "P5"],
      rationale: "A write was attempted without a resolved actor identity.",
      holds: (ctx) => !isWrite(ctx) || isResolved(ctx),
    },
    {
      id: "INV-TENANCY",
      title: "Tenant-scoped action",
      statement: "Every action is scoped to an enterprise/tenant.",
      severity: "blocking",
      derivedFrom: ["P1", "P2"],
      rationale: "An action was attempted without an enterprise/tenant scope.",
      holds: (ctx) =>
        ctx.enterpriseId.length > 0 &&
        (!isWrite(ctx) || (ctx.actor.tenantId != null && ctx.actor.tenantId.length > 0)),
    },
    {
      id: "INV-AUDITABLE",
      title: "Auditable path",
      statement: "Every mutation is carried out under an audited path.",
      severity: "blocking",
      derivedFrom: ["P4"],
      rationale: "A mutation was attempted outside of an audited path.",
      holds: (ctx) => !isWrite(ctx) || ctx.audited === true,
    },
    {
      id: "INV-AUTHORITY",
      title: "Authority present for writes",
      statement: "A write carries at least one granted permission.",
      severity: "blocking",
      derivedFrom: ["P5"],
      rationale: "A write was attempted by an actor carrying no granted permissions.",
      holds: (ctx) => !isWrite(ctx) || ctx.actor.permissions.length > 0,
    },
    {
      id: "INV-TYPED-OBJECT",
      title: "Typed object writes",
      statement: "Object writes name a canonical object type.",
      severity: "blocking",
      derivedFrom: ["P1"],
      rationale: "An object write did not name a canonical object type.",
      holds: (ctx) => {
        const touchesObject =
          ctx.kind === "object.create" ||
          ctx.kind === "object.update" ||
          ctx.kind === "object.delete";
        if (!touchesObject) return true;
        return Boolean(ctx.object?.objectType && ctx.object.objectType.length > 0);
      },
    },
  ],

  policies: [
    makePolicy(
      "POL-GOVERNED-WRITE",
      "Governed write path",
      "All mutations flow through governed intents that resolve identity, check authority, and audit the result.",
      ["INV-IDENTITY", "INV-TENANCY", "INV-AUDITABLE", "INV-AUTHORITY"],
      (ctx) => {
        if (!isWrite(ctx)) {
          return {
            effect: "allow",
            satisfied: true,
            explanation: "Non-mutating action; governed-write policy does not apply.",
            evidence: [],
          };
        }
        const checks = [
          { ok: isResolved(ctx), ref: "INV-IDENTITY", why: "resolved identity" },
          {
            ok: ctx.actor.tenantId != null && ctx.actor.tenantId.length > 0,
            ref: "INV-TENANCY",
            why: "tenant scope",
          },
          { ok: ctx.audited === true, ref: "INV-AUDITABLE", why: "audited path" },
          { ok: ctx.actor.permissions.length > 0, ref: "INV-AUTHORITY", why: "granted authority" },
        ];
        const failed = checks.filter((c) => !c.ok);
        const evidence: EvidenceItem[] = checks.map((c) => ({
          kind: "policy",
          ref: c.ref,
          observation: `${c.why}: ${c.ok ? "present" : "absent"}`,
          supports: c.ok,
        }));
        if (failed.length === 0) {
          return {
            effect: "allow",
            satisfied: true,
            explanation: "Write satisfies identity, tenancy, audit, and authority.",
            evidence,
          };
        }
        return {
          effect: "deny",
          satisfied: false,
          explanation: `Write is missing: ${failed.map((f) => f.why).join(", ")}.`,
          evidence,
          recommendation: "Route the mutation through a governed intent under a resolved, audited identity.",
        };
      },
    ),
    makePolicy(
      "POL-CANONICAL-TYPE",
      "Canonical typing",
      "Object mutations are typed against the canonical ontology.",
      ["INV-TYPED-OBJECT"],
      (ctx) => {
        const touchesObject =
          ctx.kind === "object.create" ||
          ctx.kind === "object.update" ||
          ctx.kind === "object.delete";
        const typed = Boolean(ctx.object?.objectType);
        if (!touchesObject || typed) {
          return {
            effect: "allow",
            satisfied: true,
            explanation: touchesObject
              ? `Object write is typed as "${ctx.object?.objectType}".`
              : "Action does not write an object.",
            evidence: [
              { kind: "policy", ref: "INV-TYPED-OBJECT", observation: "canonical type present", supports: true },
            ],
          };
        }
        return {
          effect: "deny",
          satisfied: false,
          explanation: "Object write did not name a canonical object type.",
          evidence: [
            { kind: "policy", ref: "INV-TYPED-OBJECT", observation: "canonical type missing", supports: false },
          ],
          recommendation: "Name the canonical object type on the write.",
        };
      },
    ),
  ],
};

/** Deep-freeze so the ratified document cannot be mutated at runtime. */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

export const LAWRENCE_CONSTITUTION: Constitution = deepFreeze(constitution);
