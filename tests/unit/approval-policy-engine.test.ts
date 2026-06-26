// Phase 6 — approval policy engine is pure + fail-closed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateApprovalPolicy } from "@/lib/mission-control/approvals/approval-policy-engine";
import type { ApprovalPolicy } from "@/lib/mission-control/approvals/approval-policy-types";

function policy(config: ApprovalPolicy["config"]): ApprovalPolicy {
  return { id: "p1", tenantId: "t", key: "k", name: "n", config, createdAt: "2026-01-01T00:00:00Z" };
}

test("missing policy fails closed (approval + reason required)", () => {
  const e = evaluateApprovalPolicy({
    tenantId: "t",
    policy: null,
    subjectType: "release_bundle",
    subjectPayload: {},
  });
  assert.equal(e.approvalRequired, true);
  assert.equal(e.reasonRequired, true);
});

test("requireApproval policy requires approval", () => {
  const e = evaluateApprovalPolicy({
    tenantId: "t",
    policy: policy({ requireApproval: true }),
    subjectType: "release_bundle",
    subjectPayload: {},
  });
  assert.equal(e.approvalRequired, true);
});

test("rule match triggers approval even when requireApproval is false", () => {
  const e = evaluateApprovalPolicy({
    tenantId: "t",
    policy: policy({ requireApproval: false, rules: [{ field: "external", operator: "eq", value: true }] }),
    subjectType: "action_execution",
    subjectPayload: { external: true },
  });
  assert.equal(e.approvalRequired, true);
  assert.equal(e.matchedRules.length, 1);
});

test("no rule match and requireApproval false => no approval", () => {
  const e = evaluateApprovalPolicy({
    tenantId: "t",
    policy: policy({ requireApproval: false, rules: [{ field: "external", operator: "eq", value: true }] }),
    subjectType: "action_execution",
    subjectPayload: { external: false },
  });
  assert.equal(e.approvalRequired, false);
});

test("kill switch always requires a reason", () => {
  const e = evaluateApprovalPolicy({
    tenantId: "t",
    policy: policy({ requireApproval: false }),
    subjectType: "kill_switch",
    subjectPayload: {},
  });
  assert.equal(e.reasonRequired, true);
});

test("rollback emergency bypass skips approval when policy allows", () => {
  const e = evaluateApprovalPolicy({
    tenantId: "t",
    policy: policy({ requireApproval: true, allowEmergencyBypass: true }),
    subjectType: "rollback",
    subjectPayload: { emergency: true },
  });
  assert.equal(e.approvalRequired, false);
});
