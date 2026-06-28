// L0 — the Constitution projected as an object.
//
// Honoring the platform's own principle ("everything is an object, including the
// Constitution; surfaces only project it"), this module turns the ratified
// document into lens-specific, serializable view models. The /constitution page
// is not bespoke documentation — it is a projection of the Constitution object,
// rendered through one of several lenses.

import type { Constitution, ConstitutionDecision } from "./contracts";

export type ConstitutionLens = "document" | "executive" | "developer" | "audit";

/**
 * A fully serializable view of the constitution — predicates (honored/met/holds/
 * evaluate) stripped — so it can cross the server→client boundary. Surfaces
 * render from this, never from the live document.
 */
export interface ConstitutionView {
  version: string;
  effectiveDate: string;
  amendments: Constitution["amendments"];
  identity: Constitution["identity"];
  mission: Constitution["mission"];
  principles: Constitution["principles"];
  rights: { id: string; holder: string; statement: string; rationale: string }[];
  responsibilities: { id: string; bearer: string; statement: string; rationale: string }[];
  invariants: {
    id: string;
    title: string;
    statement: string;
    severity: Constitution["invariants"][number]["severity"];
    derivedFrom: string[];
    rationale: string;
  }[];
  policies: { id: string; title: string; statement: string; enforces: string[] }[];
}

export function toConstitutionView(c: Constitution): ConstitutionView {
  return {
    version: c.version,
    effectiveDate: c.effectiveDate,
    amendments: c.amendments,
    identity: c.identity,
    mission: c.mission,
    principles: c.principles,
    rights: c.rights.map((r) => ({ id: r.id, holder: r.holder, statement: r.statement, rationale: r.rationale })),
    responsibilities: c.responsibilities.map((r) => ({ id: r.id, bearer: r.bearer, statement: r.statement, rationale: r.rationale })),
    invariants: c.invariants.map((i) => ({
      id: i.id,
      title: i.title,
      statement: i.statement,
      severity: i.severity,
      derivedFrom: i.derivedFrom,
      rationale: i.rationale,
    })),
    policies: c.policies.map((p) => ({ id: p.id, title: p.title, statement: p.statement, enforces: p.enforces })),
  };
}

export const CONSTITUTION_LENSES: { id: ConstitutionLens; label: string; blurb: string }[] = [
  { id: "document", label: "Document", blurb: "The ratified text: identity, mission, principles, rights, duties." },
  { id: "executive", label: "Executive", blurb: "Mission objectives, posture, and what the constitution guarantees." },
  { id: "developer", label: "Developer", blurb: "Invariants, executable policies, and the contracts they enforce." },
  { id: "audit", label: "Audit", blurb: "Replay determinism, issued execution authority, the append-only journal, lineage, and live evidenced decisions." },
];

/** A serializable summary of one decision, for the audit/evidence lens. */
export interface DecisionSummary {
  decisionId: string;
  outcome: ConstitutionDecision["outcome"];
  authorized: boolean;
  scenario: string;
  actorKind: string;
  actionKind: string;
  missionObjective: string | null;
  violations: { ref: string; rationale: string }[];
  advisories: { ref: string; rationale: string }[];
  evidence: { kind: string; ref: string; observation: string; supports: boolean }[];
  evaluatedTotal: number;
}

export function summarizeDecision(scenario: string, d: ConstitutionDecision): DecisionSummary {
  return {
    decisionId: d.decisionId,
    outcome: d.outcome,
    authorized: d.authorized,
    scenario,
    actorKind: d.context.actor.kind,
    actionKind: d.context.kind,
    missionObjective: d.missionAlignment?.title ?? null,
    violations: d.violations.map((v) => ({ ref: v.ref, rationale: v.rationale })),
    advisories: d.advisories.map((a) => ({ ref: a.ref, rationale: a.rationale })),
    evidence: d.evidence.map((e) => ({ kind: e.kind, ref: e.ref, observation: e.observation, supports: e.supports })),
    evaluatedTotal: Object.values(d.evaluated).reduce((n, x) => n + x, 0),
  };
}

/** Headline counts for the executive lens. */
export interface ConstitutionHeadline {
  principles: number;
  rights: number;
  responsibilities: number;
  invariants: number;
  blockingInvariants: number;
  policies: number;
  objectives: number;
}

export function projectHeadline(c: Constitution | ConstitutionView): ConstitutionHeadline {
  return {
    principles: c.principles.length,
    rights: c.rights.length,
    responsibilities: c.responsibilities.length,
    invariants: c.invariants.length,
    blockingInvariants: c.invariants.filter((i) => i.severity === "blocking").length,
    policies: c.policies.length,
    objectives: c.mission.objectives.length,
  };
}
