// L0 — the ratified Enterprise Constitution for the LAWRENCE platform.
//
// This is the single authoritative document. Every invariant is a pure predicate
// over a ConstitutionContext; the engine enforces them fail-closed. Editing this
// file changes what the entire platform is permitted to do — there is no other
// place rules of this rank live.

import type { Constitution, ConstitutionContext } from "./contracts";

const CONSTITUTION_VERSION = "1.0.0";

/** A write is any action that creates, updates, or deletes an object. */
function isWrite(ctx: ConstitutionContext): boolean {
  return (
    ctx.kind === "object.create" ||
    ctx.kind === "object.update" ||
    ctx.kind === "object.delete"
  );
}

const constitution: Constitution = {
  version: CONSTITUTION_VERSION,

  identity: {
    id: "lawrence",
    name: "LAWRENCE",
    descriptor:
      "A governed enterprise operating system where every surface is a projection of one canonical truth.",
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
    },
    {
      id: "R2",
      holder: "every-actor",
      statement: "To receive a clear, specific reason whenever an action is denied.",
    },
    {
      id: "R3",
      holder: "subject-of-record",
      statement:
        "To have their record changed only through a governed, audited, attributable action.",
    },
    {
      id: "R4",
      holder: "enterprise",
      statement: "To have its constitution enforced uniformly across every surface and integration.",
    },
  ],

  responsibilities: [
    {
      id: "D1",
      bearer: "every-actor",
      statement: "To act within granted authority and never to circumvent the governed path.",
    },
    {
      id: "D2",
      bearer: "every-surface",
      statement:
        "To route mutations through governed intents and never to write to the canonical model directly.",
    },
    {
      id: "D3",
      bearer: "the-runtime",
      statement:
        "To re-validate every action authoritatively on the server, treating client validation as convenience only.",
    },
    {
      id: "D4",
      bearer: "the-enterprise",
      statement: "To keep the constitution legible and current, and to version every change to it.",
    },
  ],

  invariants: [
    {
      id: "INV-IDENTITY",
      title: "No anonymous mutation",
      statement:
        "Every write is bound to a resolved principal — a user, or a tenant-scoped system/machine identity. Never anonymous.",
      severity: "blocking",
      derivedFrom: ["P2", "P5"],
      rationale: "A write was attempted without a resolved actor identity.",
      // A `user` actor must carry a user id; a `system` actor is resolved without
      // one. `anonymous` is never permitted to mutate.
      holds: (ctx) => {
        if (!isWrite(ctx)) return true;
        if (ctx.actor.kind === "anonymous") return false;
        if (ctx.actor.kind === "user") return ctx.actor.id != null && ctx.actor.id.length > 0;
        return true; // system/machine identity is resolved
      },
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
    {
      id: "POL-GOVERNED-WRITE",
      title: "Governed write path",
      statement:
        "All mutations flow through governed intents that resolve identity, check authority, and audit the result.",
      enforces: ["INV-IDENTITY", "INV-TENANCY", "INV-AUDITABLE", "INV-AUTHORITY"],
    },
    {
      id: "POL-CANONICAL-TYPE",
      title: "Canonical typing",
      statement: "Object mutations are typed against the canonical ontology.",
      enforces: ["INV-TYPED-OBJECT"],
    },
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
