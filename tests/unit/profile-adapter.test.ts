// The profile-driven "universal" adapter: a new tabular ATS source is added with
// config only (no new extractor), and a code adapter coexists in the same
// registry for the long tail (APIs / multi-sheet joins). Synthetic data only.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  registerImportAdapter,
  detectImportAdapter,
  type ImportAdapter,
  type ImportProbe,
} from "@/lib/dataops/import/import-adapter";
import { makeProfileAdapter } from "@/lib/dataops/import/profile-adapter";
import type { MappingProfile } from "@/lib/dataops/import/mapping-profile";
import type { RecruitingImportIR } from "@/lib/dataops/import/recruiting-ir";
import "@/lib/dataops/import/import-bootstrap";

// A fictional Lever-style export — added purely as a MappingProfile.
const leverProfile: MappingProfile = {
  source: "lever_test",
  detect: { requiredHeaders: ["posting id", "stage"] },
  columns: {
    name: "name",
    email: "email",
    "posting title": "postingTitle",
    "posting id": "postingId",
    stage: "stage",
    origin: "origin",
  },
  job: {
    key: ["postingId"],
    title: "postingTitle",
    externalIds: [{ system: "lever", from: "postingId" }],
  },
  candidate: { key: ["email"], fullName: ["name"], email: "email" },
  submission: { stage: "stage", metadata: { origin: "origin" } },
};

const base = {
  importRunId: "imp_1",
  importedAt: new Date(0).toISOString(),
  originalFilename: "lever.csv",
  workbookHash: "abc123",
};

function leverProbe(): ImportProbe {
  return {
    fileName: "lever.csv",
    sheets: [
      {
        name: "csv",
        rows: [
          ["Name", "Email", "Posting Title", "Posting ID", "Stage", "Origin"],
          ["Mia Cole", "mia@example.test", "Backend Engineer", "POST-5", "Phone Screen", "Applied"],
          ["Sam Roe", "sam@example.test", "Backend Engineer", "POST-5", "Offer", "Sourced"],
        ],
      },
    ],
  };
}

test("a new tabular source works with config only (no new extractor)", () => {
  const adapter = makeProfileAdapter(leverProfile);
  const ir: RecruitingImportIR = adapter.extract(leverProbe(), base);
  assert.equal(ir.jobs.length, 1);
  assert.equal(ir.candidates.length, 2);
  assert.equal(ir.submissions.length, 2);

  const job = ir.jobs[0]!;
  assert.equal(job.externalKey, "POST-5");
  assert.equal(job.source, "lever_test");
  assert.deepEqual(job.externalIds, [{ system: "lever", id: "POST-5" }]);

  const sam = ir.submissions.find((s) => s.candidateKey === "sam@example.test")!;
  assert.equal(sam.stage, "offer"); // normalized
  assert.equal(sam.metadata.origin, "Sourced");
  assert.equal(sam.provenance.source, "lever_test");
});

test("registering the profile routes detection through the shared registry", () => {
  registerImportAdapter(makeProfileAdapter(leverProfile));
  assert.equal(detectImportAdapter(leverProbe())?.key, "lever_test");
});

test("a code adapter (escape hatch) coexists with profile adapters", () => {
  // Sources needing real logic implement ImportAdapter directly — same registry,
  // same IR. Here a stand-in with a disjoint signature.
  const apiAdapter: ImportAdapter = {
    key: "custom_api_test",
    source: "custom_api_test",
    detect: (probe) =>
      probe.sheets.some((s) => (s.rows[0] ?? []).some((c) => String(c) === "API Marker")),
    extract: (_probe, b): RecruitingImportIR => ({
      provenance: {
        source: "custom_api_test",
        importRunId: b.importRunId,
        importedAt: b.importedAt,
        originalFilename: b.originalFilename,
        workbookHash: b.workbookHash,
        sheetName: null,
        rowNumber: null,
        parserVersion: "x",
        mappingVersion: "x",
      },
      jobs: [],
      candidates: [],
      submissions: [],
    }),
  };
  registerImportAdapter(apiAdapter);

  const apiProbe: ImportProbe = { fileName: "api", sheets: [{ name: "s", rows: [["API Marker"]] }] };
  assert.equal(detectImportAdapter(apiProbe)?.key, "custom_api_test");
  // The profile adapters still win their own formats — no cross-talk.
  assert.equal(detectImportAdapter(leverProbe())?.key, "lever_test");
});
