// Paste-a-profile NL extraction → draft → review. Extraction never auto-commits
// a Candidate; a reviewer confirms (creating one with provenance) or rejects.
// A stub model provides deterministic extraction; synthetic data only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { db } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import {
  extractCandidateDraft,
  confirmCandidateDraft,
  rejectCandidateDraft,
} from "@/lib/dataops/import/nl/candidate-extraction";
import {
  setModelProvider,
  MockModelProvider,
  type ModelProvider,
} from "@/lib/aiops/models/model-provider";
import { POST as extractRoute } from "../../app/api/recruiting/candidates/extract/route";
import type { ActorContext } from "@/types/platform";

const PROFILE = `Dana Diaz
Staff Engineer at Acme — Remote
dana@example.test · +1-555-0100
BS, State University`;

function stubProvider(json: Record<string, unknown>): ModelProvider {
  return {
    provider: "stub",
    modelKey: "stub-1",
    async complete() {
      return {
        text: JSON.stringify(json),
        json,
        promptTokens: 1,
        completionTokens: 1,
        latencyMs: 1,
        costUsd: 0,
        provider: "stub",
        modelKey: "stub-1",
      };
    },
  };
}

const FULL = {
  fullName: "Dana Diaz",
  email: "dana@example.test",
  phone: "+1-555-0100",
  location: "Remote",
  headline: "Staff Engineer",
  currentTitle: "Staff Engineer",
  currentCompany: "Acme",
  profileUrl: "https://linkedin.test/dana",
  educationDegree: "BS",
  educationInstitution: "State University",
  summary: "Backend engineer.",
};

test("extraction stages a draft + review case and does NOT create a Candidate", async () => {
  await resetDatabase();
  resetClock();
  setModelProvider(stubProvider(FULL));
  try {
    const ctx = systemActor("tnt_nl");
    const { extraction, reviewCase, confidence } = await extractCandidateDraft(ctx, {
      text: PROFILE,
    });

    assert.equal(extraction.objectType, "CandidateExtraction");
    assert.equal(extraction.status, "pending_review");
    assert.equal(reviewCase.caseType, "candidate_extraction");
    assert.equal(reviewCase.status, "open");
    assert.equal(confidence, 1); // all 10 profile fields populated

    // Nothing authoritative yet.
    assert.equal((await listObjects(ctx, "Candidate")).length, 0);
  } finally {
    setModelProvider(new MockModelProvider());
  }
});

test("confirm projects a real Candidate with provenance; review approved", async () => {
  await resetDatabase();
  resetClock();
  setModelProvider(stubProvider(FULL));
  try {
    const ctx = systemActor("tnt_nl");
    const { reviewCase } = await extractCandidateDraft(ctx, { text: PROFILE, source: "chat" });

    const candidate = await confirmCandidateDraft(ctx, reviewCase.id);
    assert.equal(candidate.objectType, "Candidate");
    assert.equal(candidate.externalKey, "dana@example.test");
    assert.equal(candidate.properties.source, "chat");
    const prov = candidate.properties.provenance as Record<string, unknown>;
    assert.equal(prov.source, "chat");
    assert.equal((candidate.properties.imports as unknown[]).length, 1);

    assert.equal((await listObjects(ctx, "Candidate")).length, 1);
    const closed = await db.reviewCases.get(ctx.tenantId, reviewCase.id);
    assert.equal(closed?.status, "approved");
  } finally {
    setModelProvider(new MockModelProvider());
  }
});

test("reject creates no Candidate and closes the case", async () => {
  await resetDatabase();
  resetClock();
  setModelProvider(stubProvider(FULL));
  try {
    const ctx = systemActor("tnt_nl");
    const { reviewCase, extraction } = await extractCandidateDraft(ctx, { text: PROFILE });

    await rejectCandidateDraft(ctx, reviewCase.id, "duplicate");
    assert.equal((await listObjects(ctx, "Candidate")).length, 0);
    const draft = await db.ontologyObjects.get(ctx.tenantId, extraction.id);
    assert.equal(draft?.status, "rejected");
    const closed = await db.reviewCases.get(ctx.tenantId, reviewCase.id);
    assert.equal(closed?.status, "rejected");
  } finally {
    setModelProvider(new MockModelProvider());
  }
});

test("the extract route rejects a body missing text with 400", async () => {
  const res = await extractRoute(
    new Request("http://x", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    }),
  );
  assert.equal(res.status, 400);
  const json = (await res.json()) as { ok: boolean; error: string };
  assert.equal(json.ok, false);
  assert.match(json.error, /invalid request body/);
});

test("text with no identifiable candidate is rejected up front", async () => {
  await resetDatabase();
  resetClock();
  setModelProvider(stubProvider({ summary: "Just some prose, no contact details." }));
  try {
    const ctx = systemActor("tnt_nl");
    await assert.rejects(
      () => extractCandidateDraft(ctx, { text: "hello world" }),
      /identifiable candidate/,
    );
  } finally {
    setModelProvider(new MockModelProvider());
  }
});

test("extraction and confirmation are permission-gated", async () => {
  await resetDatabase();
  resetClock();
  setModelProvider(stubProvider(FULL));
  try {
    const noPerms: ActorContext = { tenantId: "tnt_nl", actorUserId: null, permissions: [] };
    await assert.rejects(() => extractCandidateDraft(noPerms, { text: PROFILE }), /permission/i);

    const ctx = systemActor("tnt_nl");
    const { reviewCase } = await extractCandidateDraft(ctx, { text: PROFILE });
    const writerOnly: ActorContext = {
      tenantId: "tnt_nl",
      actorUserId: null,
      permissions: ["ontology.admin"], // can stage, cannot review
    };
    await assert.rejects(() => confirmCandidateDraft(writerOnly, reviewCase.id), /permission/i);
  } finally {
    setModelProvider(new MockModelProvider());
  }
});

test("extraction honors a tenant's authorized extraction model (per-purpose routing)", async () => {
  await resetDatabase();
  resetClock();
  setModelProvider(stubProvider(FULL)); // process default would succeed
  try {
    const ctx = systemActor("tnt_route");
    // Authorize a provider with no adapter for the extraction purpose. If routing
    // is live, resolveModelProvider consults this and fails closed (rather than
    // quietly using the process-default stub).
    await db.modelDefinitions.insert({
      id: "md_route",
      tenantId: ctx.tenantId,
      provider: "other",
      modelKey: "x",
      purpose: "extraction",
      config: {},
      status: "active",
    });
    await assert.rejects(() => extractCandidateDraft(ctx, { text: PROFILE }), /adapter/i);
  } finally {
    setModelProvider(new MockModelProvider());
  }
});
