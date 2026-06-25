import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { ingestAsset, registerSource, detectKind } from "@/lib/dataops/sources/source-service";
import { runAssetPipeline } from "@/lib/dataops/pipelines/pipeline-runner";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { parseCsv } from "@/lib/dataops/parsers/csv-parser";
import { resolveTransform } from "@/lib/dataops/transforms/transform-registry";

async function freshCtx() {
  await resetDatabase();
  resetClock();
  return systemActor("tnt_test");
}

test("csv parser handles quoted fields with commas", () => {
  const rows = parseCsv('a,b\n"x,y",z\n1,2');
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.a, "x,y");
  assert.equal(rows[1]!.b, "2");
});

test("detectKind maps extensions", () => {
  assert.equal(detectKind("a.csv"), "csv");
  assert.equal(detectKind("a.pdf"), "pdf");
  assert.equal(detectKind("a.bogus"), "unknown");
});

test("trim transform trims string columns", async () => {
  const ctx = await freshCtx();
  const t = resolveTransform("trim")!;
  const out = await t.run({ rows: [{ name: "  ada  ", n: 3 }], config: {} }, ctx);
  assert.equal(out.rows[0]!.name, "ada");
  assert.equal(out.rows[0]!.n, 3);
});

test("case_when transform writes derived column", async () => {
  const ctx = await freshCtx();
  const t = resolveTransform("case_when")!;
  const out = await t.run(
    {
      rows: [{ score: 90 }, { score: 10 }],
      config: {
        column: "tier",
        cases: [{ when: { col: "score", equals: 90 }, then: "A" }],
        else: "C",
      },
    },
    ctx,
  );
  assert.equal(out.rows[0]!.tier, "A");
  assert.equal(out.rows[1]!.tier, "C");
});

test("pipeline ingests CSV and projects ontology candidates", async () => {
  const ctx = await freshCtx();
  const source = await registerSource(ctx, { name: "Upload", kind: "upload" });
  const asset = await ingestAsset(ctx, {
    fileName: "c.csv",
    content: "full_name,email\nAda,ada@x.com\nAlan,alan@x.com",
    sourceId: source.id,
  });
  const result = await runAssetPipeline(ctx, asset, { ontologyMapper: "recruiting" });
  assert.equal(result.run.status, "completed");
  assert.equal(result.records.length, 2);
  const candidates = await listObjects(ctx, "Candidate");
  assert.equal(candidates.length, 2);
  assert.ok(candidates.some((c) => c.externalKey === "ada@x.com"));
});

test("tenant isolation: another tenant sees no objects", async () => {
  const ctx = await freshCtx();
  const asset = await ingestAsset(ctx, { fileName: "c.csv", content: "full_name\nAda" });
  await runAssetPipeline(ctx, asset, { ontologyMapper: "recruiting" });
  const other = systemActor("tnt_other");
  assert.equal((await listObjects(other, "Candidate")).length, 0);
});
