// Paste-a-JD job extraction → draft → review. Extraction never auto-commits a
// Job; a reviewer confirms (creating one) or rejects. Approval also works through
// the standard review-cases resolve route. Synthetic data; stub model.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase, db } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import {
  extractJobDraft,
  confirmJobDraft,
  rejectJobDraft,
} from "@/lib/dataops/import/nl/job-extraction";
import { setModelProvider, MockModelProvider, type ModelProvider } from "@/lib/aiops/models/model-provider";
import { POST as jobExtractRoute } from "../../app/api/recruiting/jobs/extract/route";
import { POST as resolveRoute } from "../../app/api/mission-control/review-cases/[caseId]/resolve/route";
import { appContext } from "@/lib/app/demo-context";
import type { ActorContext } from "@/types/platform";

const JD = "Staff Engineer at Acme — Remote. Full-time, Senior. $150,000–$200,000 USD/yr. Build backend.";
const FIELDS = {
  title: "Staff Engineer",
  company: "Acme",
  location: "Remote",
  employmentType: "Full-time",
  seniority: "Senior",
  minSalary: "150000",
  maxSalary: "200000",
  currency: "USD",
  compensationPeriod: "YEARLY",
  summary: "Build backend.",
  requirements: "Go, k8s",
};

function stub(json: Record<string, unknown>): ModelProvider {
  return {
    provider: "stub",
    modelKey: "stub-1",
    async complete() {
      return { text: JSON.stringify(json), json, promptTokens: 1, completionTokens: 1, latencyMs: 1, costUsd: 0, provider: "stub", modelKey: "stub-1" };
    },
  };
}

test("JD extraction stages a draft + review case and does NOT create a Job", async () => {
  await resetDatabase();
  resetClock();
  setModelProvider(stub(FIELDS));
  try {
    const ctx = systemActor("tnt_jd");
    const { extraction, reviewCase, proposed, confidence } = await extractJobDraft(ctx, { text: JD });
    assert.equal(extraction.objectType, "JobExtraction");
    assert.equal(extraction.status, "pending_review");
    assert.equal(reviewCase.caseType, "job_extraction");
    assert.equal(proposed.externalKey, "paste:staff-engineer@acme");
    assert.equal(confidence, 1);
    assert.equal((await listObjects(ctx, "Job")).length, 0);
  } finally {
    setModelProvider(new MockModelProvider());
  }
});

test("confirm projects a real Job with compensation + provenance", async () => {
  await resetDatabase();
  resetClock();
  setModelProvider(stub(FIELDS));
  try {
    const ctx = systemActor("tnt_jd");
    const { reviewCase } = await extractJobDraft(ctx, { text: JD });
    const job = await confirmJobDraft(ctx, reviewCase.id);
    assert.equal(job.objectType, "Job");
    assert.equal(job.externalKey, "paste:staff-engineer@acme");
    assert.equal(job.status, "open");
    assert.deepEqual(job.properties.compensation, { min: 150000, max: 200000, currency: "USD", period: "YEARLY" });
    assert.equal((job.properties.imports as unknown[]).length, 1);
    assert.equal((await listObjects(ctx, "Job")).length, 1);
  } finally {
    setModelProvider(new MockModelProvider());
  }
});

test("reject creates no Job", async () => {
  await resetDatabase();
  resetClock();
  setModelProvider(stub(FIELDS));
  try {
    const ctx = systemActor("tnt_jd");
    const { reviewCase, extraction } = await extractJobDraft(ctx, { text: JD });
    await rejectJobDraft(ctx, reviewCase.id);
    assert.equal((await listObjects(ctx, "Job")).length, 0);
    const draft = await db.ontologyObjects.get(ctx.tenantId, extraction.id);
    assert.equal(draft?.status, "rejected");
  } finally {
    setModelProvider(new MockModelProvider());
  }
});

test("a JD with no title is rejected up front, and extraction is permission-gated", async () => {
  await resetDatabase();
  resetClock();
  setModelProvider(stub({ company: "Acme", summary: "no title here" }));
  try {
    const ctx = systemActor("tnt_jd");
    await assert.rejects(() => extractJobDraft(ctx, { text: JD }), /identifiable job/);

    setModelProvider(stub(FIELDS));
    const noPerms: ActorContext = { tenantId: "tnt_jd", actorUserId: null, permissions: [] };
    await assert.rejects(() => extractJobDraft(noPerms, { text: JD }), /permission/i);
  } finally {
    setModelProvider(new MockModelProvider());
  }
});

test("the jobs extract route rejects a body missing text with 400", async () => {
  const res = await jobExtractRoute(
    new Request("http://x", { method: "POST", body: JSON.stringify({}), headers: { "content-type": "application/json" } }),
  );
  assert.equal(res.status, 400);
  const json = (await res.json()) as { ok: boolean; error: string };
  assert.equal(json.ok, false);
  assert.match(json.error, /invalid request body/);
});

test("approving a job_extraction case via the resolve route projects the Job", async () => {
  await resetDatabase();
  resetClock();
  await appContext(); // pre-warm demo bootstrap so the route call does not wipe the draft
  setModelProvider(stub(FIELDS));
  try {
    const ctx = systemActor("tnt_demo");
    const { reviewCase } = await extractJobDraft(ctx, { text: JD });
    const before = (await listObjects(ctx, "Job")).filter((j) => j.externalKey === "paste:staff-engineer@acme");
    assert.equal(before.length, 0);

    const res = await resolveRoute(
      new Request("http://x", { method: "POST", body: JSON.stringify({ decision: "approved" }), headers: { "content-type": "application/json" } }),
      { params: { caseId: reviewCase.id } },
    );
    assert.equal(res.status, 200);
    const json = (await res.json()) as { reviewCase: { status: string }; result: { externalKey: string } | null };
    assert.equal(json.reviewCase.status, "approved");
    assert.equal(json.result?.externalKey, "paste:staff-engineer@acme");

    const after = (await listObjects(ctx, "Job")).filter((j) => j.externalKey === "paste:staff-engineer@acme");
    assert.equal(after.length, 1, "Job projected on approval");
  } finally {
    setModelProvider(new MockModelProvider());
  }
});
