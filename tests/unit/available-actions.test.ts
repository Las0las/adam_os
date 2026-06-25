// Phase 5 (Part N) — unit tests for the available-actions mapping. Pure lookup;
// asserts each object type exposes the expected governed/function/review actions.

import { test } from "node:test";
import assert from "node:assert/strict";
import { availableActionsForObject } from "@/lib/domains/object-detail/available-actions";

test("Candidate exposes shortlist (approval) and a fit-summary function action", () => {
  const actions = availableActionsForObject("Candidate");

  const shortlist = actions.find((a) => a.actionKey === "recruiting.shortlist_candidate");
  assert.ok(shortlist, "shortlist action present");
  assert.equal(shortlist.requiresApproval, true, "shortlist requires approval");

  const fit = actions.find((a) => a.actionKey === "recruiting.candidate_fit_summary");
  assert.ok(fit, "fit-summary action present");
  assert.equal(fit.input?.runKind, "function", "fit summary routes as a function run");
});

test("ReviewCase exposes approve/reject/request_changes/escalate review decisions", () => {
  const actions = availableActionsForObject("ReviewCase");
  const decisions = actions.map((a) => a.input?.decision);
  for (const decision of ["approved", "rejected", "request_changes", "escalate"]) {
    assert.ok(decisions.includes(decision), `decision ${decision} present`);
  }
  for (const a of actions) {
    assert.equal(a.input?.runKind, "review", "review actions route as review decisions");
  }
});

test("unknown object type yields no actions", () => {
  assert.deepEqual(availableActionsForObject("NotARealType"), []);
});
