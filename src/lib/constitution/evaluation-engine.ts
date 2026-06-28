// L0 — Constitution Evaluation Engine.
//
// The single, generalized evaluator at the heart of the Constitution Runtime.
// The legacy invariant engine evaluated only invariants; this engine evaluates
// EVERY constitutional dimension — identity, authority, mission, rights,
// responsibilities, policies, invariants — collects the evidence trail, and
// produces a ConstitutionDecision (the execution-authority token).
//
// Pure and deterministic: the same constitution + context always yields the same
// decision (including a stable decisionId). Fail-closed: a throwing predicate
// counts as a failure, never a silent pass.

import type {
  Constitution,
  ConstitutionContext,
  ConstitutionDecision,
  ConstitutionViolation,
  DecisionOutcome,
  EvidenceItem,
  EvidenceKind,
  PolicyEvaluation,
} from "./contracts";
import { RESOLVED_PRINCIPAL_KINDS } from "./contracts";

/** A write is any action that creates, updates, or deletes an object. */
function isWrite(ctx: ConstitutionContext): boolean {
  return (
    ctx.kind === "object.create" ||
    ctx.kind === "object.update" ||
    ctx.kind === "object.delete"
  );
}

/**
 * Deterministic, dependency-free hash → stable decisionId. Same inputs always
 * produce the same id so decisions are replay-verifiable. (FNV-1a 32-bit.)
 */
function stableId(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function emptyDimensionCounts(): Record<EvidenceKind, number> {
  return {
    identity: 0,
    authority: 0,
    mission: 0,
    right: 0,
    responsibility: 0,
    policy: 0,
    invariant: 0,
  };
}

/**
 * Evaluate the mission dimension: which active objective (highest priority) this
 * action best advances. Read-only and advisory — mission never blocks, but it is
 * recorded as evidence so the platform can reason about purpose.
 */
function evaluateMission(
  constitution: Constitution,
  ctx: ConstitutionContext,
): { alignment: { objectiveId: string; title: string } | null; evidence: EvidenceItem } {
  const objectives = [...constitution.mission.objectives].sort((a, b) => a.priority - b.priority);
  // Writes advance the operating objectives; reads/projections serve transparency.
  const chosen = isWrite(ctx) || ctx.kind === "intent.emit" || ctx.kind === "workflow.transition"
    ? objectives[0] ?? null
    : objectives.find((o) => /transparen|eviden|account/i.test(o.statement)) ?? objectives[0] ?? null;

  return {
    alignment: chosen ? { objectiveId: chosen.id, title: chosen.title } : null,
    evidence: {
      kind: "mission",
      ref: chosen?.id ?? "none",
      observation: chosen
        ? `Action serves objective "${chosen.title}".`
        : "No active mission objective matched.",
      supports: true,
    },
  };
}

/**
 * The core authorization function. Produces a complete, evidenced decision.
 */
export function decide(
  constitution: Constitution,
  ctx: ConstitutionContext,
): ConstitutionDecision {
  const evidence: EvidenceItem[] = [];
  const violations: ConstitutionViolation[] = [];
  const advisories: ConstitutionViolation[] = [];
  const evaluated = emptyDimensionCounts();

  // ── 1. Identity ───────────────────────────────────────────────────────────
  evaluated.identity = 1;
  const resolved = RESOLVED_PRINCIPAL_KINDS.includes(ctx.actor.kind);
  const identitySupports = resolved || !isWrite(ctx);
  evidence.push({
    kind: "identity",
    ref: ctx.actor.kind,
    observation: resolved
      ? `Principal resolved as ${ctx.actor.kind}${ctx.actor.id ? ` (${ctx.actor.id})` : ""}.`
      : "No principal resolved (anonymous).",
    supports: identitySupports,
  });
  if (!identitySupports) {
    violations.push({
      dimension: "identity",
      ref: ctx.actor.kind,
      title: "Resolved identity required",
      severity: "blocking",
      rationale: "A mutation was attempted by an anonymous principal.",
      recommendation: "Authenticate or resolve a system/service identity before mutating.",
    });
  }

  // ── 2. Authority ────────────────────────────────────────────────────────--
  evaluated.authority = 1;
  const hasAuthority = !isWrite(ctx) || ctx.actor.permissions.length > 0;
  evidence.push({
    kind: "authority",
    ref: "permissions",
    observation: `${ctx.actor.permissions.length} permission(s) granted.`,
    supports: hasAuthority,
  });
  if (!hasAuthority) {
    violations.push({
      dimension: "authority",
      ref: "permissions",
      title: "Authority required for writes",
      severity: "blocking",
      rationale: "A write was attempted by an actor carrying no granted permissions.",
      recommendation: "Grant the least-privilege permission required for this action.",
    });
  }

  // ── 3. Mission ──────────────────────────────────────────────────────────--
  evaluated.mission = constitution.mission.objectives.length;
  const mission = evaluateMission(constitution, ctx);
  evidence.push(mission.evidence);

  // ── 4. Rights ───────────────────────────────────────────────────────────--
  for (const right of constitution.rights) {
    evaluated.right += 1;
    let honored: boolean;
    try {
      honored = right.honored(ctx) === true;
    } catch {
      honored = false;
    }
    evidence.push({
      kind: "right",
      ref: right.id,
      observation: honored ? `Right ${right.id} honored.` : `Right ${right.id} not honored.`,
      supports: honored,
    });
    if (!honored) {
      violations.push({
        dimension: "right",
        ref: right.id,
        title: `Right ${right.id}`,
        severity: "blocking",
        rationale: right.rationale,
      });
    }
  }

  // ── 5. Responsibilities ───────────────────────────────────────────────────
  for (const resp of constitution.responsibilities) {
    evaluated.responsibility += 1;
    let met: boolean;
    try {
      met = resp.met(ctx) === true;
    } catch {
      met = false;
    }
    evidence.push({
      kind: "responsibility",
      ref: resp.id,
      observation: met ? `Responsibility ${resp.id} met.` : `Responsibility ${resp.id} unmet.`,
      supports: met,
    });
    if (!met) {
      // Responsibilities are advisory by default — they inform, not block.
      advisories.push({
        dimension: "responsibility",
        ref: resp.id,
        title: `Responsibility ${resp.id}`,
        severity: "advisory",
        rationale: resp.rationale,
      });
    }
  }

  // ── 6. Policies (executable) ────────────────────────────────────────────--
  const policyEvaluations: PolicyEvaluation[] = [];
  for (const policy of constitution.policies) {
    evaluated.policy += 1;
    let evaluation: PolicyEvaluation;
    try {
      evaluation = policy.evaluate(ctx);
    } catch {
      evaluation = {
        policyId: policy.id,
        effect: "deny",
        satisfied: false,
        explanation: "Policy evaluation threw; denied fail-closed.",
        evidence: [],
      };
    }
    policyEvaluations.push(evaluation);
    for (const ev of evaluation.evidence) evidence.push(ev);
    if (!evaluation.satisfied) {
      const blocking = evaluation.effect === "deny";
      const v: ConstitutionViolation = {
        dimension: "policy",
        ref: policy.id,
        title: policy.title,
        severity: blocking ? "blocking" : "advisory",
        rationale: evaluation.explanation,
        recommendation: evaluation.recommendation,
      };
      if (blocking) violations.push(v);
      else advisories.push(v);
    }
  }

  // ── 7. Invariants ─────────────────────────────────────────────────────────
  for (const inv of constitution.invariants) {
    evaluated.invariant += 1;
    let satisfied: boolean;
    try {
      satisfied = inv.holds(ctx) === true;
    } catch {
      satisfied = false;
    }
    evidence.push({
      kind: "invariant",
      ref: inv.id,
      observation: satisfied ? `${inv.id} holds.` : `${inv.id} violated.`,
      supports: satisfied,
    });
    if (satisfied) continue;
    const v: ConstitutionViolation = {
      dimension: "invariant",
      ref: inv.id,
      title: inv.title,
      severity: inv.severity,
      rationale: inv.rationale,
    };
    if (inv.severity === "blocking") violations.push(v);
    else advisories.push(v);
  }

  // ── Decision ────────────────────────────────────────────────────────────--
  const outcome: DecisionOutcome =
    violations.length > 0 ? "denied" : advisories.length > 0 ? "authorized_with_advice" : "authorized";
  const authorized = outcome !== "denied";

  const timestamp = new Date().toISOString();
  // decisionId is stable across the action identity (NOT the timestamp) so the
  // same action replays to the same id.
  const idSeed = JSON.stringify({
    v: constitution.version,
    k: ctx.kind,
    a: ctx.actor.kind,
    aid: ctx.actor.id,
    t: ctx.enterpriseId,
    o: ctx.object ?? null,
    p: ctx.projection ?? null,
    w: ctx.workflow ?? null,
    outcome,
    violations: violations.map((x) => x.ref),
  });

  return {
    decisionId: `cd_${stableId(idSeed)}`,
    timestamp,
    constitutionVersion: constitution.version,
    outcome,
    authorized,
    context: ctx,
    missionAlignment: mission.alignment,
    policyEvaluations,
    violations,
    advisories,
    evidence,
    evaluated,
  };
}
