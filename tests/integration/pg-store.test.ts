// Postgres integration test (Phase 3). Runs the REAL services against a live
// Postgres (the same code that backs the in-memory runtime) and proves rows are
// actually persisted to the rt_* document tables. Skipped unless DATABASE_URL is
// set — run with:  DATABASE_URL=postgres://... npx tsx --test tests/integration/*.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

const HAS_DB = Boolean(process.env.DATABASE_URL);

test("postgres backend persists the full bootstrap path", { skip: !HAS_DB }, async () => {
  const { bootstrap, DEMO_TENANT_ID } = await import("@/lib/lawrence-core/bootstrap");
  const { systemActor } = await import("@/lib/lawrence-core/permissions/permissions");
  const { listObjects } = await import("@/lib/dataops/ontology/object-service");
  const { retrieve } = await import("@/lib/aiops/retrieval/retrieval-service");
  const { runFunction } = await import("@/lib/aiops/functions/function-runner");
  const { getDb } = await import("@/lib/lawrence-core/db/pg/client");

  await bootstrap();
  const ctx = systemActor(DEMO_TENANT_ID);

  // Ontology projection landed.
  const candidates = await listObjects(ctx, "Candidate");
  assert.ok(candidates.length >= 3, "expected seeded candidates");

  // Prove it is really in Postgres: query the rt_ document table directly.
  const pool = getDb();
  const objCount = await pool.query<{ n: string }>(
    "select count(*)::text as n from rt_ontology_objects where tenant_id = $1",
    [DEMO_TENANT_ID],
  );
  assert.ok(Number(objCount.rows[0]?.n ?? "0") >= candidates.length, "rt_ontology_objects populated");

  // Retrieval over persisted evidence chunks works.
  const res = await retrieve(ctx, {
    tenantId: ctx.tenantId,
    query: "compiler systems programmer",
    methods: ["rank_fusion"],
    limit: 3,
  });
  assert.ok(res.hits.length > 0, "expected retrieval hits from pg-backed evidence");

  // A function run completes and persists with citations.
  const run = await runFunction(ctx, "answer_with_citations", {
    question: "who has cryptanalysis experience",
    objectTypes: ["Candidate"],
  });
  assert.equal(run.status, "completed");

  const runCount = await pool.query<{ n: string }>(
    "select count(*)::text as n from rt_function_runs where tenant_id = $1",
    [DEMO_TENANT_ID],
  );
  assert.ok(Number(runCount.rows[0]?.n ?? "0") >= 1, "rt_function_runs populated");
});
