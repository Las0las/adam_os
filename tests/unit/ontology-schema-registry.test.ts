// ONT-001 conformance — the canonical schema registry covers the four foundational
// objects, its status domains match ONT-001 §Lifecycle, and required-field rules
// match ONT-001 §Public Interfaces. Pure (no DB).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { z } from "zod";
import { schemaFor, registeredObjectTypes } from "@/lib/dataops/ontology/schemas/registry";
import { validateCanonicalObject } from "@/lib/dataops/ontology/schemas/validate";
import { CANDIDATE_STATUS } from "@/lib/dataops/ontology/schemas/candidate.schema";
import { JOB_STATUS } from "@/lib/dataops/ontology/schemas/job.schema";
import { ACCOUNT_STATUS } from "@/lib/dataops/ontology/schemas/account.schema";
import { CANDIDATE_STAGES } from "@/lib/dataops/ontology/schemas/submission.schema";

function statusOptions(objectType: string): string[] {
  const schema = schemaFor(objectType);
  assert.ok(schema, `schema registered for ${objectType}`);
  return (schema!.status as z.ZodEnum<[string, ...string[]]>).options;
}

test("registry covers the four ONT-001 canonical objects", () => {
  for (const t of ["Candidate", "Job", "Submission", "Account"]) {
    assert.ok(schemaFor(t), `schema registered for ${t}`);
  }
  assert.deepEqual(
    [...registeredObjectTypes()].sort(),
    ["Account", "Candidate", "Job", "Submission"],
  );
});

test("status domains match ONT-001 §Lifecycle", () => {
  assert.deepEqual(statusOptions("Candidate"), [...CANDIDATE_STATUS]);
  assert.deepEqual(statusOptions("Job"), [...JOB_STATUS]);
  assert.deepEqual(statusOptions("Account"), [...ACCOUNT_STATUS]);
  // Submission status SHALL be the CandidateStage pipeline lifecycle.
  assert.deepEqual(statusOptions("Submission"), [...CANDIDATE_STAGES]);
  assert.deepEqual(
    [...CANDIDATE_STAGES],
    ["new", "screen", "submitted", "interview", "offer", "placed", "rejected"],
  );
});

test("required-field parity — missing required fields produce violations", () => {
  // Candidate requires at least one of fullName | email.
  const candV = validateCanonicalObject(schemaFor("Candidate"), {
    objectType: "Candidate",
    status: "new",
    properties: {},
  });
  assert.ok(candV.some((v) => v.path === "properties.fullName"));

  // Job requires a top-level title.
  const jobV = validateCanonicalObject(schemaFor("Job"), {
    objectType: "Job",
    status: "open",
    title: null,
    properties: {},
  });
  assert.ok(jobV.some((v) => v.path === "title"));

  // Submission requires jobKey, candidateKey, stage.
  const subV = validateCanonicalObject(schemaFor("Submission"), {
    objectType: "Submission",
    status: "submitted",
    properties: {},
  }).map((v) => v.path);
  for (const p of ["properties.jobKey", "properties.candidateKey", "properties.stage"]) {
    assert.ok(subV.includes(p), `expected violation for ${p}`);
  }

  // Account requires a top-level title.
  const acctV = validateCanonicalObject(schemaFor("Account"), {
    objectType: "Account",
    status: "active",
    title: null,
    properties: {},
  });
  assert.ok(acctV.some((v) => v.path === "title"));
});

test("a fully valid canonical object produces no violations", () => {
  assert.deepEqual(
    validateCanonicalObject(schemaFor("Submission"), {
      objectType: "Submission",
      status: "submitted",
      title: "Ada → Engineer",
      properties: { jobKey: "job-1", candidateKey: "cand-1", stage: "submitted" },
    }),
    [],
  );
});

test("unregistered objectType yields no violations", () => {
  assert.deepEqual(
    validateCanonicalObject(schemaFor("RecruiterNote"), {
      objectType: "RecruiterNote",
      status: "anything",
      properties: {},
    }),
    [],
  );
});
