// End-to-end LinkedIn Recruiter import: ingest XLSX -> parser detects adapter ->
// canonical IR records -> recruiting mapper -> Candidate/Job/Submission objects
// and graph links. Synthetic dummy data only; no real applicant PII.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { ingestUpload } from "@/lib/dataops/ingestion/asset-ingest-service";
import { resolveParser } from "@/lib/dataops/parsers/parser-registry";
import { recruitingObjectMapper } from "@/lib/dataops/ontology/recruiting-object-mapper";
import { listObjects, linksFor } from "@/lib/dataops/ontology/object-service";
import { RECRUITING_SUBMISSION_RECORD_TYPE } from "@/lib/dataops/import/recruiting-ir";
import type { CanonicalRecord } from "@/types/dataops";

const HEADER = [
  "First Name", "Last Name", "Email Address", "Phone Number", "General Location",
  "ZIP Code", "Headline", "Current Title", "Current Company", "Current Position Start Date",
  "Education Degree", "Education Institution", "Profile URL", "Date Applied", "Current Stage",
  "Job ID", "Job Title", "Job URL", "ATS Job ID", "Minimum Salary", "Maximum Salary",
  "Currency Code", "Compensation Period", "Hiring Project ID", "Hiring Project Title",
  "Contract ID", "Contract Name", "Screening Questions",
];

function applicant(first: string, email: string, stage: string): unknown[] {
  return [
    first, "Tester", email, "+1-555-0100", "Remote", "00000", "Headline", "Engineer",
    "Acme", "2020-01-01", "BS", "State U", `https://linkedin.test/${first}`, "2026-06-01",
    stage, "J-100", "Staff Engineer", "https://linkedin.test/jobs/J-100", "ATS-9",
    "100000", "150000", "USD", "YEARLY", "HP-1", "Backend Hiring", "C-1", "MSA", "Q1: yes",
  ];
}

function buildWorkbook(): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([["Job Applicant Report", null], ["Created on", "2026-06-08"]]),
    "Overview",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      HEADER,
      applicant("Ada", "ada@example.test", "Applicant"),
      applicant("Alan", "alan@example.test", "Interview"),
    ]),
    "Job Applicants",
  );
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

test("LinkedIn xlsx ingests into Candidate/Job/Submission with provenance and links", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_li");

  const asset = await ingestUpload(ctx, {
    fileName: "Job_Applicant_Report.xlsx",
    bytes: buildWorkbook(),
  });
  const parser = resolveParser(asset);
  assert.equal(parser?.key, "xlsx");

  const out = await parser!.parse(asset);
  assert.equal(out.document?.documentType, "linkedin_recruiter_export");
  assert.equal((out.document?.metadata?.counts as Record<string, number>).submissions, 2);
  assert.equal(out.records?.length, 2);
  assert.equal(out.records![0]!.recordType, RECRUITING_SUBMISSION_RECORD_TYPE);

  // Project every record through the recruiting mapper.
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
  assert.equal(candidates.length, 2, "two candidates");
  assert.equal(submissions.length, 2, "two submissions");

  const job = jobs[0]!;
  assert.equal(job.externalKey, "J-100");
  assert.equal(job.properties.atsJobId, "ATS-9");

  const ada = candidates.find((c) => c.externalKey === "ada@example.test")!;
  assert.ok(ada, "candidate keyed on email");
  const prov = ada.properties.provenance as Record<string, unknown>;
  assert.equal(prov.source, "linkedin_recruiter");
  assert.equal(prov.sheetName, "Job Applicants");

  // The job is upserted once per applicant row but records a single ledger
  // entry for the one import run.
  assert.equal((job.properties.imports as unknown[]).length, 1, "one ledger entry per import");

  // Graph: Candidate ──submitted──► Submission ──targets──► Job.
  const adaSub = submissions.find((s) => s.externalKey === "J-100::ada@example.test")!;
  assert.equal(adaSub.status, "new"); // "Applicant" -> new
  const adaLinks = await linksFor(ctx, adaSub.id);
  assert.ok(adaLinks.some((l) => l.linkType === "submitted" && l.toObjectId === adaSub.id));
  assert.ok(adaLinks.some((l) => l.linkType === "targets" && l.toObjectId === job.id));
});

test("re-importing the same workbook is idempotent (upsert, not duplicate)", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_li2");

  for (let pass = 0; pass < 2; pass += 1) {
    const asset = await ingestUpload(ctx, { fileName: "r.xlsx", bytes: buildWorkbook() });
    const out = await resolveParser(asset)!.parse(asset);
    for (const [i, r] of (out.records ?? []).entries()) {
      await recruitingObjectMapper.map(ctx, {
        id: `rec_${pass}_${i}`,
        tenantId: ctx.tenantId,
        documentId: "doc",
        recordType: r.recordType,
        payload: r.payload,
        sourcePath: null,
        createdAt: new Date(0).toISOString(),
      });
    }
  }

  assert.equal((await listObjects(ctx, "Job")).length, 1);
  assert.equal((await listObjects(ctx, "Candidate")).length, 2);
  assert.equal((await listObjects(ctx, "Submission")).length, 2);

  // Two distinct import runs leave an append-only provenance trail of length 2,
  // with the first entry preserved unchanged.
  const job = (await listObjects(ctx, "Job"))[0]!;
  const imports = job.properties.imports as Array<Record<string, unknown>>;
  assert.equal(imports.length, 2, "one ledger entry per import run");
  assert.notEqual(imports[0]!.importRunId, imports[1]!.importRunId);
});
