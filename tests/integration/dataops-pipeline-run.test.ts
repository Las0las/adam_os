import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { ingestUpload } from "@/lib/dataops/ingestion/asset-ingest-service";
import { runAssetPipeline } from "@/lib/dataops/pipelines/pipeline-runner";

async function freshCtx() {
  await resetDatabase();
  resetClock();
  return systemActor("tnt_test");
}

function buildXlsxBuffer(): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([
    ["name", "score"],
    ["Ada", 90],
    ["Alan", 80],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "People");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function buildEml(): string {
  const attachment = Buffer.from("hello attachment", "utf8").toString("base64");
  return [
    "From: alice@example.com",
    "To: bob@example.com",
    "Subject: Hi there",
    'Content-Type: multipart/mixed; boundary="BOUND"',
    "",
    "--BOUND",
    "Content-Type: text/plain",
    "",
    "Email body text.",
    "--BOUND",
    'Content-Type: text/plain; name="note.txt"',
    "Content-Transfer-Encoding: base64",
    'Content-Disposition: attachment; filename="note.txt"',
    "",
    attachment,
    "--BOUND--",
    "",
  ].join("\r\n");
}

test("ingestUpload JSON then runAssetPipeline persists canonical records", async () => {
  const ctx = await freshCtx();
  const asset = await ingestUpload(ctx, {
    fileName: "data.json",
    content: JSON.stringify([{ a: 1 }, { a: 2 }, { a: 3 }]),
  });
  const result = await runAssetPipeline(ctx, asset);
  assert.equal(result.run.status, "completed");
  assert.equal(result.records.length, 3);
  const persisted = await db.canonicalRecords.list(ctx.tenantId);
  assert.equal(persisted.length, 3);
});

test("ingestUpload dedups by checksum unless forced", async () => {
  const ctx = await freshCtx();
  const a1 = await ingestUpload(ctx, { fileName: "d.json", content: "[]" });
  const a2 = await ingestUpload(ctx, { fileName: "d.json", content: "[]" });
  assert.equal(a1.id, a2.id, "duplicate returns existing asset");
  const a3 = await ingestUpload(ctx, { fileName: "d.json", content: "[]", force: true });
  assert.notEqual(a1.id, a3.id, "force creates a new asset");
});

test("XLSX pipeline records have sheet/row sourcePath", async () => {
  const ctx = await freshCtx();
  const asset = await ingestUpload(ctx, { fileName: "data.xlsx", bytes: buildXlsxBuffer() });
  const result = await runAssetPipeline(ctx, asset);
  assert.equal(result.run.status, "completed");
  assert.equal(result.records.length, 2);
  for (const r of result.records) {
    assert.match(r.sourcePath!, /sheet:.*;row:/);
  }
});

test("EML pipeline yields email_message doc and a child raw_asset", async () => {
  const ctx = await freshCtx();
  const asset = await ingestUpload(ctx, { fileName: "msg.eml", content: buildEml() });
  const result = await runAssetPipeline(ctx, asset);
  assert.equal(result.run.status, "completed");
  assert.equal(result.document?.documentType, "email_message");

  const children = await db.rawAssets.list(ctx.tenantId, (a) => a.parentAssetId === asset.id);
  assert.equal(children.length, 1);
  assert.equal(children[0]!.parentAssetId, asset.id);
});
