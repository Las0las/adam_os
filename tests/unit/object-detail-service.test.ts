// Phase 5 (Part N) — object-detail service tests. Seeds a single Candidate with
// evidence + an open review case, then asserts getObjectDetail assembles the full
// governed context, and that a missing id raises ObjectNotFoundError.

import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { upsertObject } from "@/lib/dataops/ontology/object-service";
import { indexEvidence } from "@/lib/dataops/evidence/chunking-service";
import { openReviewCase } from "@/lib/mission-control/review-queue/review-service";
import {
  getObjectDetail,
  ObjectNotFoundError,
} from "@/lib/domains/object-detail/object-detail-service";

test("getObjectDetail assembles object + evidence + reviews + actions", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");

  const candidate = await upsertObject(ctx, {
    objectType: "Candidate",
    externalKey: "cand-test",
    title: "Marcus Test",
    status: "active",
    properties: { headline: "Power BI developer" },
  });

  await indexEvidence(
    ctx,
    { objectType: "Candidate", objectId: candidate.id },
    "Marcus has eight years of Power BI and analytics engineering experience.",
  );

  await openReviewCase(ctx, {
    caseType: "recruiting.candidate_fit_review",
    subject: { type: "Candidate", id: candidate.id },
    severity: "medium",
    summary: "Candidate fit needs review",
  });

  const detail = await getObjectDetail(ctx, "Candidate", candidate.id);

  assert.equal(detail.object.objectType, "Candidate");
  assert.equal(detail.object.objectId, candidate.id);
  assert.ok(detail.evidence.length >= 1, "evidence present");
  assert.ok(detail.reviews.length >= 1, "open review present");
  assert.ok(detail.actions.length >= 1, "actions present");
  assert.ok(
    detail.actions.some((a) => a.actionKey === "recruiting.shortlist_candidate"),
    "actions include a Candidate-specific action",
  );
});

test("getObjectDetail throws ObjectNotFoundError for a missing id", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");

  await assert.rejects(
    () => getObjectDetail(ctx, "Candidate", "obj_does_not_exist"),
    ObjectNotFoundError,
  );
});
