// LinkedIn Recruiter import adapter — pure IR extraction (no DB). Uses synthetic
// dummy data only; never real applicant PII.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  linkedinRecruiterAdapter,
} from "@/lib/dataops/import/adapters/linkedin-recruiter-adapter";
import { detectImportAdapter, type ImportProbe } from "@/lib/dataops/import/import-adapter";
import "@/lib/dataops/import/import-bootstrap";
import { normalizeStage } from "@/lib/dataops/import/recruiting-ir";

// Two synthetic applicants, both applying to the SAME job (Job ID J-100).
const APPLICANTS_HEADER = [
  "First Name", "Last Name", "Email Address", "Phone Number", "General Location",
  "ZIP Code", "Headline", "Current Title", "Current Company", "Current Position Start Date",
  "Education Degree", "Education Institution", "Profile URL", "Date Applied", "Current Stage",
  "Job ID", "Job Title", "Job URL", "ATS Job ID", "Minimum Salary", "Maximum Salary",
  "Currency Code", "Compensation Period", "Hiring Project ID", "Hiring Project Title",
  "Contract ID", "Contract Name", "Screening Questions",
];

function row(first: string, email: string, stage: string): unknown[] {
  return [
    first, "Tester", email, "+1-555-0100", "Remote",
    "00000", "Headline", "Engineer", "Acme", "2020-01-01",
    "BS", "State U", `https://linkedin.test/${first}`, "2026-06-01", stage,
    "J-100", "Staff Engineer", "https://linkedin.test/jobs/J-100", "ATS-9", "100000", "150000",
    "USD", "YEARLY", "HP-1", "Backend Hiring", "C-1", "MSA", "Q1: yes",
  ];
}

function probe(): ImportProbe {
  return {
    fileName: "report.xlsx",
    sheets: [
      { name: "Overview", rows: [["Job Applicant Report", null], ["Created on", "2026-06-08"]] },
      {
        name: "Job Applicants",
        rows: [APPLICANTS_HEADER, row("Ada", "ada@example.test", "Applicant"), row("Alan", "alan@example.test", "Interview")],
      },
    ],
  };
}

const base = {
  importRunId: "imp_1",
  importedAt: new Date(0).toISOString(),
  originalFilename: "report.xlsx",
  workbookHash: "deadbeef",
};

test("adapter detects the LinkedIn 2-tab format", () => {
  assert.equal(detectImportAdapter(probe())?.key, "linkedin_recruiter");
});

test("adapter does not claim an unrelated workbook", () => {
  const generic: ImportProbe = {
    fileName: "people.xlsx",
    sheets: [{ name: "People", rows: [["name", "score"], ["Ada", 90]] }],
  };
  assert.equal(detectImportAdapter(generic), undefined);
});

test("extract dedupes the shared job and emits one submission per applicant", () => {
  const ir = linkedinRecruiterAdapter.extract(probe(), base);
  assert.equal(ir.jobs.length, 1, "one job");
  assert.equal(ir.candidates.length, 2, "two candidates");
  assert.equal(ir.submissions.length, 2, "two submissions");

  const job = ir.jobs[0]!;
  assert.equal(job.externalKey, "J-100"); // canonical = LinkedIn Job ID
  assert.equal(job.title, "Staff Engineer");
  assert.deepEqual(job.externalIds, [
    { system: "linkedin", id: "J-100" },
    { system: "ats", id: "ATS-9" },
  ]);
  assert.deepEqual(job.compensation, { min: 100000, max: 150000, currency: "USD", period: "YEARLY" });
});

test("candidate keyed on email; submission carries normalized + raw stage and provenance", () => {
  const ir = linkedinRecruiterAdapter.extract(probe(), base);
  const ada = ir.candidates.find((c) => c.email === "ada@example.test")!;
  assert.equal(ada.externalKey, "ada@example.test");
  assert.equal(ada.fullName, "Ada Tester");

  const sub = ir.submissions.find((s) => s.candidateKey === "ada@example.test")!;
  assert.equal(sub.externalKey, "J-100::ada@example.test");
  assert.equal(sub.stage, "new"); // "Applicant" normalizes to new
  assert.equal(sub.rawStage, "Applicant");
  assert.equal(sub.appliedAt, "2026-06-01");
  // immutable provenance points back to the exact source row.
  assert.equal(sub.provenance.workbookHash, "deadbeef");
  assert.equal(sub.provenance.sheetName, "Job Applicants");
  assert.equal(sub.provenance.rowNumber, 2);
});

test("stage normalization maps source vocabularies onto the canonical lifecycle", () => {
  assert.equal(normalizeStage("Phone Screen"), "screen");
  assert.equal(normalizeStage("Interviewing"), "interview");
  assert.equal(normalizeStage("Offer Extended"), "offer");
  assert.equal(normalizeStage("Hired"), "placed");
  assert.equal(normalizeStage("Declined"), "rejected");
  assert.equal(normalizeStage("Something New"), "new");
  assert.equal(normalizeStage(""), "new");
});
