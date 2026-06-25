// Phase 5 (Part N) — evidence citations are produced and re-readable through the
// trace surface. Runs the recruiting candidate-fit summary for a seeded candidate
// + job, asserts the function run carries citations, and that getRunTrace exposes
// the same citations array (what the UI renders in the trace drawer).

import { test } from "node:test";
import assert from "node:assert/strict";
import { bootstrap, DEMO_TENANT_ID } from "@/lib/lawrence-core/bootstrap";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { runFunction } from "@/lib/aiops/functions/function-runner";
import { getRunTrace } from "@/lib/domains/object-detail/object-detail-service";

test("candidate fit summary emits citations that render through the trace", async () => {
  await bootstrap();
  const ctx = systemActor(DEMO_TENANT_ID);

  const candidate = (await listObjects(ctx, "Candidate")).find(
    (c) => c.externalKey === "cand-marcus",
  );
  const job = (await listObjects(ctx, "Job")).find((j) => j.externalKey === "job-powerbi");
  assert.ok(candidate, "seeded candidate cand-marcus present");
  assert.ok(job, "seeded job job-powerbi present");

  const run = await runFunction(ctx, "recruiting.candidate_fit_summary", {
    candidateId: candidate.id,
    jobId: job.id,
  });
  assert.equal(run.status, "completed");
  assert.ok((run.citations ?? []).length >= 1, "function run carries >=1 citation");

  const trace = await getRunTrace(ctx, "function", run.id);
  assert.ok(trace, "trace resolved for the function run");
  assert.ok(Array.isArray(trace.citations), "trace exposes a citations array");
  assert.ok((trace.citations as unknown[]).length >= 1, "trace citations non-empty");
});
