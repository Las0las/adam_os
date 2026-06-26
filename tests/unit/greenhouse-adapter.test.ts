// Greenhouse adapter — pure IR extraction + detection isolation from LinkedIn.
// Synthetic dummy data only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { greenhouseAdapter } from "@/lib/dataops/import/adapters/greenhouse-adapter";
import { detectImportAdapter, type ImportProbe } from "@/lib/dataops/import/import-adapter";
import "@/lib/dataops/import/import-bootstrap";

const HEADER = [
  "Candidate Name", "Email", "Phone", "Location", "Job Name",
  "Requisition ID", "Stage", "Applied At", "Source", "Recruiter",
];

function probe(): ImportProbe {
  return {
    fileName: "greenhouse.csv",
    sheets: [
      {
        name: "csv",
        rows: [
          HEADER,
          ["Dana Diaz", "dana@example.test", "+1-555-0101", "Remote", "Staff Engineer", "REQ-77", "Phone Screen", "2026-06-02", "LinkedIn", "Riley"],
          ["Evan Ng", "evan@example.test", "+1-555-0102", "NYC", "Staff Engineer", "REQ-77", "Offer", "2026-06-03", "Referral", "Riley"],
        ],
      },
    ],
  };
}

const base = {
  importRunId: "imp_1",
  importedAt: new Date(0).toISOString(),
  originalFilename: "greenhouse.csv",
  workbookHash: "cafef00d",
};

test("detection routes the Greenhouse export to its adapter", () => {
  assert.equal(detectImportAdapter(probe())?.key, "greenhouse");
});

test("Greenhouse and LinkedIn adapters do not both claim the same probe", () => {
  // LinkedIn requires a "Job Applicants" sheet with "job id"; Greenhouse uses a
  // single sheet with "requisition id" — the signatures are disjoint.
  const liLike: ImportProbe = {
    fileName: "x.xlsx",
    sheets: [{ name: "Job Applicants", rows: [["First Name", "Email Address", "Job ID"], ["A", "a@test", "J1"]] }],
  };
  assert.equal(detectImportAdapter(liLike)?.key, "linkedin_recruiter");
  assert.equal(greenhouseAdapter.detect(liLike), false);
});

test("extract maps Greenhouse vocabulary onto the canonical IR", () => {
  const ir = greenhouseAdapter.extract(probe(), base);
  assert.equal(ir.jobs.length, 1);
  assert.equal(ir.candidates.length, 2);
  assert.equal(ir.submissions.length, 2);

  const job = ir.jobs[0]!;
  assert.equal(job.externalKey, "REQ-77"); // canonical = Requisition ID
  assert.equal(job.source, "greenhouse");
  assert.deepEqual(job.externalIds, [{ system: "greenhouse", id: "REQ-77" }]);

  const dana = ir.submissions.find((s) => s.candidateKey === "dana@example.test")!;
  assert.equal(dana.stage, "screen"); // "Phone Screen" -> screen
  assert.equal(dana.rawStage, "Phone Screen");
  const evan = ir.submissions.find((s) => s.candidateKey === "evan@example.test")!;
  assert.equal(evan.stage, "offer");
  assert.equal(evan.provenance.source, "greenhouse");
});
