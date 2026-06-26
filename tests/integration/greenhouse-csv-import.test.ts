// End-to-end Greenhouse CSV import: the csv parser detects the adapter, emits
// canonical submission records, and the recruiting mapper projects the same
// Candidate/Job/Submission ontology shape as the LinkedIn (xlsx) path — proving
// the import framework spans both source formats. Synthetic dummy data only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { resolveParser } from "@/lib/dataops/parsers/parser-registry";
import { recruitingObjectMapper } from "@/lib/dataops/ontology/recruiting-object-mapper";
import { listObjects, linksFor } from "@/lib/dataops/ontology/object-service";
import { RECRUITING_SUBMISSION_RECORD_TYPE } from "@/lib/dataops/import/recruiting-ir";
import type { CanonicalRecord, RawAsset } from "@/types/dataops";

const CSV = [
  "Candidate Name,Email,Phone,Location,Job Name,Requisition ID,Stage,Applied At,Source,Recruiter",
  "Dana Diaz,dana@example.test,+1-555-0101,Remote,Staff Engineer,REQ-77,Phone Screen,2026-06-02,LinkedIn,Riley",
  "Evan Ng,evan@example.test,+1-555-0102,NYC,Staff Engineer,REQ-77,Offer,2026-06-03,Referral,Riley",
].join("\n");

function csvAsset(content: string): RawAsset {
  return {
    id: "asset_gh",
    tenantId: "tnt_gh",
    sourceId: null,
    kind: "csv",
    fileName: "greenhouse.csv",
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

test("Greenhouse CSV ingests into Candidate/Job/Submission with links", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_gh");

  const asset = csvAsset(CSV);
  const parser = resolveParser(asset);
  assert.equal(parser?.key, "csv");

  const out = await parser!.parse(asset);
  assert.equal(out.document?.documentType, "greenhouse_export");
  assert.equal(out.records?.length, 2);
  assert.equal(out.records![0]!.recordType, RECRUITING_SUBMISSION_RECORD_TYPE);

  for (const [i, r] of (out.records ?? []).entries()) {
    const record: CanonicalRecord = {
      id: `rec_${i}`,
      tenantId: ctx.tenantId,
      documentId: "doc_1",
      recordType: r.recordType,
      payload: r.payload,
      sourcePath: r.sourcePath ?? null,
      createdAt: new Date(0).toISOString(),
    };
    await recruitingObjectMapper.map(ctx, record);
  }

  const jobs = await listObjects(ctx, "Job");
  const candidates = await listObjects(ctx, "Candidate");
  const submissions = await listObjects(ctx, "Submission");
  assert.equal(jobs.length, 1, "one deduped job");
  assert.equal(candidates.length, 2);
  assert.equal(submissions.length, 2);

  const job = jobs[0]!;
  assert.equal(job.externalKey, "REQ-77");
  assert.equal((job.properties.provenance as Record<string, unknown>).source, "greenhouse");

  const evanSub = submissions.find((s) => s.externalKey === "REQ-77::evan@example.test")!;
  assert.equal(evanSub.status, "offer"); // "Offer" -> offer
  const links = await linksFor(ctx, evanSub.id);
  assert.ok(links.some((l) => l.linkType === "submitted"));
  assert.ok(links.some((l) => l.linkType === "targets" && l.toObjectId === job.id));
});

test("a non-recruiting CSV still uses the generic row projection", async () => {
  await resetDatabase();
  resetClock();
  const asset = csvAsset("name,score\nAda,90\nAlan,80");
  const out = await resolveParser(asset)!.parse(asset);
  assert.equal(out.document?.documentType, "csv");
  assert.equal(out.records?.length, 2);
  assert.equal(out.records![0]!.recordType, "csv_row");
});
