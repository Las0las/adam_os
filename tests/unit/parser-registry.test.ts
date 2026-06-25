import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { ingestUpload } from "@/lib/dataops/ingestion/asset-ingest-service";
import { resolveParser } from "@/lib/dataops/parsers/parser-registry";
import type { RawAsset } from "@/types/dataops";

async function freshCtx() {
  await resetDatabase();
  resetClock();
  return systemActor("tnt_test");
}

function textAsset(kind: RawAsset["kind"], fileName: string, content: string): RawAsset {
  return {
    id: "asset_x",
    tenantId: "tnt_test",
    sourceId: null,
    kind,
    fileName,
    mimeType: null,
    checksumSha256: null,
    sizeBytes: content.length,
    parentAssetId: null,
    ingestionBatchId: null,
    storagePath: null,
    content,
    metadata: {},
    createdAt: new Date(0).toISOString(),
  };
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

test("resolveParser routes json and produces records", async () => {
  await freshCtx();
  const asset = textAsset("json", "a.json", JSON.stringify([{ a: 1 }, { a: 2 }]));
  const parser = resolveParser(asset);
  assert.ok(parser, "json parser resolved");
  const out = await parser!.parse(asset);
  assert.equal(out.document?.documentType, "json");
  assert.equal(out.records?.length, 2);
});

test("resolveParser routes csv and produces records", async () => {
  await freshCtx();
  const asset = textAsset("csv", "a.csv", "name,score\nAda,90\nAlan,80");
  const parser = resolveParser(asset);
  assert.ok(parser);
  const out = await parser!.parse(asset);
  assert.equal(out.document?.documentType, "csv");
  assert.equal(out.records?.length, 2);
});

test("resolveParser routes xml and produces records", async () => {
  await freshCtx();
  const xml = "<people><person><name>Ada</name></person><person><name>Alan</name></person></people>";
  const asset = textAsset("xml", "a.xml", xml);
  const parser = resolveParser(asset);
  assert.ok(parser);
  assert.equal(parser!.key, "xml");
  const out = await parser!.parse(asset);
  assert.equal(out.document?.documentType, "xml_document");
  assert.equal(out.records?.length, 2);
  assert.match(out.records![0]!.sourcePath!, /person\[0\]/);
});

test("resolveParser routes xlsx (via ingest -> storagePath) and produces rows", async () => {
  const ctx = await freshCtx();
  const asset = await ingestUpload(ctx, { fileName: "data.xlsx", bytes: buildXlsxBuffer() });
  assert.equal(asset.kind, "xlsx");
  assert.ok(asset.storagePath, "xlsx stored to disk");
  const parser = resolveParser(asset);
  assert.ok(parser);
  assert.equal(parser!.key, "xlsx");
  const out = await parser!.parse(asset);
  assert.equal(out.document?.documentType, "spreadsheet");
  assert.equal(out.records?.length, 2);
  assert.match(out.records![0]!.sourcePath!, /sheet:.*;row:/);
});

test("resolveParser routes eml with attachment -> childAssets", async () => {
  const ctx = await freshCtx();
  const asset = await ingestUpload(ctx, { fileName: "msg.eml", content: buildEml() });
  assert.equal(asset.kind, "eml");
  const parser = resolveParser(asset);
  assert.ok(parser);
  assert.equal(parser!.key, "eml");
  const out = await parser!.parse(asset);
  assert.equal(out.document?.documentType, "email_message");
  assert.equal(out.childAssets?.length, 1);
  assert.equal(out.childAssets![0]!.metadata?.["attachment"], true);
});
