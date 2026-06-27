// VS-008 — Enterprise Governance Orchestrator. Composes object (VS-003),
// relationship (VS-004), graph (VS-005), preflight (VS-007), and policy stages
// into one deterministic GovernanceDecision. Warn = advisory; enforce = blocks on
// blocking findings. In-memory DB backend.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import {
  evaluateGovernance,
  getGovernanceMetrics,
  resetGovernanceMetrics,
} from "@/lib/dataops/ontology/governance/governance-orchestrator";
import { GovernanceDecisionError } from "@/lib/dataops/ontology/governance/governance-errors";
import { resetGovernanceEnforcementOverrides } from "@/lib/dataops/ontology/governance/governance-enforcement";
import {
  registerGovernancePolicy,
  clearGovernancePolicies,
} from "@/lib/dataops/ontology/governance/governance-policy-registry";
import { resetGraphMetrics } from "@/lib/dataops/ontology/graph/graph-integrity";
import { resetPreflightMetrics } from "@/lib/dataops/ontology/graph/graph-preflight";
import type { GraphRule, OntologyGraph, OntologyObject, OntologyLink } from "@/lib/dataops/ontology/graph/graph-types";

function obj(id: string, objectType: string, status: string | null = null, properties: Record<string, unknown> = {}): OntologyObject {
  return { id, tenantId: "t", objectType, externalKey: id, title: id, status, properties, createdAt: "t0", updatedAt: "t0" };
}
function link(linkType: string, from: OntologyObject, to: OntologyObject): OntologyLink {
  return { id: `l_${from.id}_${linkType}_${to.id}`, tenantId: "t", linkType, fromObjectType: from.objectType, fromObjectId: from.id, toObjectType: to.objectType, toObjectId: to.id, createdAt: "t0" };
}
const EMPTY: OntologyGraph = { objects: [], links: [] };
const NO_RULES: GraphRule[] = [];

async function auditByAction(tenantId: string, action: string) {
  return await db.auditEvents.list(tenantId, (e) => e.action === action);
}

beforeEach(async () => {
  await resetDatabase();
  resetClock();
  resetGovernanceEnforcementOverrides();
  resetGovernanceMetrics();
  resetGraphMetrics();
  resetPreflightMetrics();
  clearGovernancePolicies();
});
afterEach(() => {
  resetGovernanceEnforcementOverrides();
  clearGovernancePolicies();
});

test("PASS: a clean graph yields PASS / pass", async () => {
  const ctx = systemActor("tnt_pass");
  const d = await evaluateGovernance(ctx, { subjectType: "mission", subjectId: "m1", graph: EMPTY, rules: NO_RULES, mode: "warn" });
  assert.equal(d.executionDecision, "PASS");
  assert.equal(d.overallStatus, "pass");
  assert.equal(d.blockingFindings.length, 0);
  assert.equal((await auditByAction(ctx.tenantId, "ontology.governance.passed")).length, 1);
  assert.equal(getGovernanceMetrics().passed, 1);
});

test("WARNING: warning-only findings yield PASS_WITH_WARNINGS in warn mode", async () => {
  const ctx = systemActor("tnt_warn");
  // Valid Candidate object (no object findings); graph rule flags missing resume as a WARNING.
  const c = obj("c1", "Candidate", "new", { fullName: "Ada" });
  const rules: GraphRule[] = [{ objectType: "Candidate", requiredRelationships: [{ linkType: "has_resume", direction: "out", min: 1, severity: "warning" }] }];
  const d = await evaluateGovernance(ctx, { subjectType: "workflow", subjectId: "w1", graph: { objects: [c], links: [] }, rules, mode: "warn" });
  assert.equal(d.overallStatus, "warning");
  assert.equal(d.executionDecision, "PASS_WITH_WARNINGS");
  assert.ok(d.warningFindings.length > 0);
  assert.equal(d.blockingFindings.length, 0);
  assert.equal((await auditByAction(ctx.tenantId, "ontology.governance.warning")).length, 1);
});

test("BLOCKED: a blocking finding throws GovernanceDecisionError in enforce mode", async () => {
  const ctx = systemActor("tnt_enf");
  // Candidate with an out-of-domain status → object-stage error (blocking).
  const c = obj("c1", "Candidate", "bogus", { fullName: "Ada" });
  await assert.rejects(
    () => evaluateGovernance(ctx, { subjectType: "mission", subjectId: "m1", graph: { objects: [c], links: [] }, rules: NO_RULES, mode: "enforce" }),
    (err: unknown) => {
      assert.ok(err instanceof GovernanceDecisionError);
      assert.equal(err.decision.executionDecision, "BLOCKED");
      assert.ok(err.decision.objectFindings.some((f) => f.code === "invalid_status"));
      return true;
    },
  );
  assert.equal((await auditByAction(ctx.tenantId, "ontology.governance.blocked")).length, 1);
  assert.equal(getGovernanceMetrics().blocked, 1);
});

test("blocking finding is advisory (PASS_WITH_WARNINGS) in warn mode — never blocks", async () => {
  const ctx = systemActor("tnt_advisory");
  const c = obj("c1", "Candidate", "bogus", { fullName: "Ada" });
  const d = await evaluateGovernance(ctx, { subjectType: "mission", subjectId: "m1", graph: { objects: [c], links: [] }, rules: NO_RULES, mode: "warn" });
  assert.equal(d.executionDecision, "PASS_WITH_WARNINGS");
  assert.equal(d.overallStatus, "failed"); // integrity verdict is mode-independent
  assert.ok(d.blockingFindings.length > 0);
});

test("mixed findings populate every stage bucket", async () => {
  const ctx = systemActor("tnt_mixed");
  const c = obj("c1", "Candidate", "bogus", {}); // object error: invalid_status + missing fullName|email
  const a = obj("a1", "Account", "active", {});
  const badLink = link("totally_unknown", c, a); // relationship warning: unknown_relationship_type
  // graph rule → warning on Candidate
  const rules: GraphRule[] = [{ objectType: "Candidate", requiredRelationships: [{ linkType: "has_resume", direction: "out", min: 1, severity: "warning" }] }];
  const d = await evaluateGovernance(ctx, { subjectType: "import", subjectId: "imp1", graph: { objects: [c, a], links: [badLink] }, rules, mode: "warn" });

  assert.ok(d.objectFindings.length > 0, "object findings");
  assert.ok(d.relationshipFindings.some((f) => f.code === "unknown_relationship_type"), "relationship findings");
  assert.ok(d.graphFindings.length > 0, "graph findings");
  // blocking = object error(s); warnings = relationship unknown + graph warning
  assert.ok(d.blockingFindings.every((f) => f.severity === "error"));
  assert.ok(d.warningFindings.some((f) => f.stage === "relationship"));
  assert.ok(d.warningFindings.some((f) => f.stage === "graph"));
});

test("stages run in order: object → relationship → graph → policy", async () => {
  const ctx = systemActor("tnt_order");
  const d = await evaluateGovernance(ctx, { subjectType: "api", subjectId: "api1", graph: EMPTY, rules: NO_RULES, mode: "warn" });
  assert.deepEqual(d.metrics.stages, ["object", "relationship", "graph", "policy"]);
});

test("policy extension point contributes findings and can block in enforce mode", async () => {
  const ctx = systemActor("tnt_policy");
  registerGovernancePolicy({
    id: "test.requires_thing",
    description: "test policy",
    evaluate: () => [{ stage: "policy", code: "POLICY_TEST", severity: "error", message: "policy failed" }],
  });
  await assert.rejects(
    () => evaluateGovernance(ctx, { subjectType: "agent", subjectId: "ag1", graph: EMPTY, rules: NO_RULES, mode: "enforce" }),
    (err: unknown) => {
      assert.ok(err instanceof GovernanceDecisionError);
      assert.ok(err.decision.policyFindings.some((f) => f.code === "POLICY_TEST"));
      return true;
    },
  );
});

test("a throwing policy is isolated, not fatal", async () => {
  const ctx = systemActor("tnt_policy_err");
  registerGovernancePolicy({
    id: "test.broken",
    description: "throws",
    evaluate: () => { throw new Error("boom"); },
  });
  const d = await evaluateGovernance(ctx, { subjectType: "automation", subjectId: "auto1", graph: EMPTY, rules: NO_RULES, mode: "warn" });
  assert.ok(d.policyFindings.some((f) => f.code === "POLICY_EVALUATION_ERROR"));
  assert.equal(d.executionDecision, "PASS_WITH_WARNINGS"); // isolated as a warning
});

test("no write-path changes: evaluating a snapshot creates no objects/links", async () => {
  const ctx = systemActor("tnt_nowrite");
  const c = obj("c1", "Candidate", "bogus", {});
  await evaluateGovernance(ctx, { subjectType: "mission", subjectId: "m1", graph: { objects: [c], links: [] }, rules: NO_RULES, mode: "warn" });
  assert.equal((await db.ontologyObjects.list(ctx.tenantId)).length, 0);
  assert.equal((await db.ontologyLinks.list(ctx.tenantId)).length, 0);
});

test("deterministic decisions", async () => {
  const ctx = systemActor("tnt_det");
  const c = obj("c1", "Candidate", "bogus", {});
  const a = await evaluateGovernance(ctx, { subjectType: "mission", subjectId: "m1", graph: { objects: [c], links: [] }, rules: NO_RULES, mode: "warn" });
  const b = await evaluateGovernance(ctx, { subjectType: "mission", subjectId: "m1", graph: { objects: [c], links: [] }, rules: NO_RULES, mode: "warn" });
  assert.deepEqual(a.blockingFindings, b.blockingFindings);
  assert.deepEqual(a.warningFindings, b.warningFindings);
});
