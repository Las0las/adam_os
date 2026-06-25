import { test } from "node:test";
import assert from "node:assert/strict";
import { bootstrap, DEMO_TENANT_ID } from "@/lib/lawrence-core/bootstrap";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { runFunction } from "@/lib/aiops/functions/function-runner";
import { resolveFunction } from "@/lib/aiops/functions/function-registry";
import { resolveAction } from "@/lib/mission-control/actions/action-service";
import { resolveObjectMapper } from "@/lib/dataops/ontology/object-mapper-registry";

test("all domain packs register their mappers", () => {
  for (const key of ["recruiting", "onboarding", "support", "claims", "commercial"]) {
    assert.ok(resolveObjectMapper(key), `mapper missing: ${key}`);
  }
});

test("domain functions and actions are registered", () => {
  for (const key of [
    "answer_with_citations",
    "generate_draft_response",
    "recommend_next_action",
    "classify_ticket_severity",
    "detect_missing_docs",
    "detect_contradictions",
    "summarize_account_risk",
  ]) {
    assert.ok(resolveFunction(key), `function missing: ${key}`);
  }
  for (const key of ["advance_candidate_stage", "recommend_manual_review", "escalate_margin_exception"]) {
    assert.ok(resolveAction(key), `action missing: ${key}`);
  }
});

test("bootstrap seeds objects across every domain", async () => {
  await bootstrap();
  const ctx = systemActor(DEMO_TENANT_ID);
  assert.ok(listObjects(ctx, "Candidate").length >= 1);
  assert.ok(listObjects(ctx, "OnboardingCase").length >= 1);
  assert.ok(listObjects(ctx, "KnowledgeDocument").length >= 1);
  assert.ok(listObjects(ctx, "ClaimDocument").length >= 1);
  assert.ok(listObjects(ctx, "Account").length >= 1);
});

test("classify_ticket_severity returns a severity", async () => {
  await bootstrap();
  const ctx = systemActor(DEMO_TENANT_ID);
  const run = await runFunction(ctx, "classify_ticket_severity", { text: "Production is down, urgent outage" });
  assert.equal(run.status, "completed");
  assert.equal((run.output as { severity: string }).severity, "p1");
});

test("detect_missing_docs computes the set difference", async () => {
  await bootstrap();
  const ctx = systemActor(DEMO_TENANT_ID);
  const run = await runFunction(ctx, "detect_missing_docs", {
    caseId: "x",
    requiredDocs: ["id", "tax", "nda"],
    presentDocs: ["id", "tax"],
  });
  const out = run.output as { missing: string[]; complete: boolean };
  assert.deepEqual(out.missing, ["nda"]);
  assert.equal(out.complete, false);
});
