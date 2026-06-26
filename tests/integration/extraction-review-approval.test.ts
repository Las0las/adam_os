// Closing the loop: approving a candidate_extraction review case through the
// standard resolve route must PROJECT the proposed Candidate (and rejecting must
// discard it), not merely flip the case status. Synthetic data; stub model.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase, db } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { extractCandidateDraft } from "@/lib/dataops/import/nl/candidate-extraction";
import { setModelProvider, MockModelProvider, type ModelProvider } from "@/lib/aiops/models/model-provider";
import { POST as resolveRoute } from "../../app/api/mission-control/review-cases/[caseId]/resolve/route";
import { appContext } from "@/lib/app/demo-context";

function stub(json: Record<string, unknown>): ModelProvider {
  return {
    provider: "stub",
    modelKey: "stub-1",
    async complete() {
      return { text: JSON.stringify(json), json, promptTokens: 1, completionTokens: 1, latencyMs: 1, costUsd: 0, provider: "stub", modelKey: "stub-1" };
    },
  };
}

const FULL = {
  fullName: "Dana Diaz",
  email: "dana@example.test",
  headline: "Staff Engineer",
  currentTitle: "Staff Engineer",
};

function resolveReq(decision: string, note?: string): Request {
  return new Request("http://x", {
    method: "POST",
    body: JSON.stringify({ decision, note }),
    headers: { "content-type": "application/json" },
  });
}

test("approving an extraction case projects the Candidate", async () => {
  await resetDatabase();
  resetClock();
  await appContext(); // pre-warm demo bootstrap so the route call does not wipe the draft
  setModelProvider(stub(FULL));
  try {
    const ctx = systemActor("tnt_demo");
    const { reviewCase } = await extractCandidateDraft(ctx, { text: "Dana Diaz, Staff Engineer, dana@example.test" });
    const before = (await listObjects(ctx, "Candidate")).filter((c) => c.externalKey === "dana@example.test");
    assert.equal(before.length, 0, "no Candidate before approval");

    const res = await resolveRoute(resolveReq("approved"), { params: { caseId: reviewCase.id } });
    assert.equal(res.status, 200);
    const json = (await res.json()) as { reviewCase: { status: string }; candidate: { externalKey: string } | null };
    assert.equal(json.reviewCase.status, "approved");
    assert.equal(json.candidate?.externalKey, "dana@example.test");

    // Assert by the synthetic key (the route's appContext may demo-seed others).
    const dana = (await listObjects(ctx, "Candidate")).filter((c) => c.externalKey === "dana@example.test");
    assert.equal(dana.length, 1, "Candidate projected on approval");
  } finally {
    setModelProvider(new MockModelProvider());
  }
});

test("rejecting an extraction case creates no Candidate", async () => {
  await resetDatabase();
  resetClock();
  await appContext(); // pre-warm demo bootstrap so the route call does not wipe the draft
  setModelProvider(stub(FULL));
  try {
    const ctx = systemActor("tnt_demo");
    const { reviewCase, extraction } = await extractCandidateDraft(ctx, { text: "Dana Diaz dana@example.test" });

    const res = await resolveRoute(resolveReq("rejected", "duplicate"), { params: { caseId: reviewCase.id } });
    assert.equal(res.status, 200);
    const json = (await res.json()) as { reviewCase: { status: string }; candidate: null };
    assert.equal(json.reviewCase.status, "rejected");
    assert.equal(json.candidate, null);

    const dana = (await listObjects(ctx, "Candidate")).filter((c) => c.externalKey === "dana@example.test");
    assert.equal(dana.length, 0, "no Candidate created on rejection");
    const draft = await db.ontologyObjects.get(ctx.tenantId, extraction.id);
    assert.equal(draft?.status, "rejected");
  } finally {
    setModelProvider(new MockModelProvider());
  }
});
