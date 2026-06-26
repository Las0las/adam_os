// Canonical Recruiting Intermediate Representation (IR).
//
// Every recruiting import adapter (LinkedIn Recruiter, Bullhorn, Greenhouse,
// Lever, Ashby, CSV/XLSX, API, …) emits this same source-agnostic shape. The
// ontology layer projects the IR into Candidate / Job / Submission objects, so
// adding a new ATS means writing one adapter — never touching the ontology.
//
//   Import Adapter ──► Recruiting IR ──► Ontology Mapping ──► Graph + Audit
//
// The IR carries immutable ingestion provenance so every projected object is
// traceable back to the exact workbook + sheet + row that created it.

import type { CandidateStage } from "@/types/domain";

/** Bumped when the parser/extraction logic changes shape. */
export const RECRUITING_PARSER_VERSION = "1.0.0";
/** Bumped when the IR -> ontology projection changes shape. */
export const RECRUITING_MAPPING_VERSION = "1.0.0";

/** Immutable provenance describing where an imported entity came from. */
export interface ImportProvenance {
  source: string; // adapter source key, e.g. "linkedin_recruiter"
  importRunId: string; // correlates every object from one import
  importedAt: string; // ISO timestamp
  originalFilename: string | null;
  workbookHash: string | null; // sha256 of source bytes
  sheetName: string | null;
  rowNumber: number | null; // 1-based row in the source sheet
  parserVersion: string;
  mappingVersion: string;
}

/** A foreign identifier the canonical object also answers to. */
export interface IRExternalId {
  system: string; // e.g. "linkedin", "ats", "greenhouse"
  id: string;
}

export interface IRJob {
  /** Canonical key LAWRENCE owns (LinkedIn Job ID for the LinkedIn adapter). */
  externalKey: string;
  source: string;
  title: string | null;
  url: string | null;
  /** Other systems' ids for the same job (ATS id, etc.). */
  externalIds: IRExternalId[];
  location: string | null;
  compensation: {
    min: number | null;
    max: number | null;
    currency: string | null;
    period: string | null;
  } | null;
  hiringProject: { id: string | null; title: string | null } | null;
  contract: { id: string | null; name: string | null } | null;
  provenance: ImportProvenance;
  metadata: Record<string, unknown>;
}

export interface IRCandidate {
  /** Canonical key: email, falling back to profile URL, then name. */
  externalKey: string;
  source: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  headline: string | null;
  currentTitle: string | null;
  currentCompany: string | null;
  profileUrl: string | null;
  education: { degree: string | null; institution: string | null } | null;
  provenance: ImportProvenance;
  metadata: Record<string, unknown>;
}

export interface IRSubmission {
  /** Canonical key: `${jobKey}::${candidateKey}` — one per application. */
  externalKey: string;
  source: string;
  jobKey: string;
  candidateKey: string;
  appliedAt: string | null;
  stage: CandidateStage; // normalized lifecycle stage
  rawStage: string | null; // source stage label, preserved verbatim
  screeningAnswers: string | null;
  provenance: ImportProvenance;
  metadata: Record<string, unknown>;
}

/** The full result of one import run, before ontology projection. */
export interface RecruitingImportIR {
  provenance: ImportProvenance;
  jobs: IRJob[];
  candidates: IRCandidate[];
  submissions: IRSubmission[];
}

/** One source application row, bundling its job+candidate+submission. This is
 *  the per-record payload carried through the canonical pipeline so the mapper
 *  can project a complete sub-graph idempotently. */
export interface RecruitingSubmissionRecord {
  job: IRJob;
  candidate: IRCandidate;
  submission: IRSubmission;
}

/** recordType marker emitted by adapters for the per-application payload. */
export const RECRUITING_SUBMISSION_RECORD_TYPE = "recruiting_submission";

/**
 * Map a source stage label onto LAWRENCE's canonical CandidateStage. Source
 * systems use wildly different vocabularies ("Applicant", "Phone Screen",
 * "Hired", "Declined"); we normalize loosely and always preserve the raw label
 * on the submission. Unknown labels default to "new" (never lost — rawStage
 * keeps the original).
 */
export function normalizeStage(raw: string | null | undefined): CandidateStage {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return "new";
  if (/(reject|declin|withdraw|pass|not\s*(a\s*)?fit|dispositioned)/.test(s)) return "rejected";
  if (/(plac|hir|start)/.test(s)) return "placed";
  if (/offer/.test(s)) return "offer";
  if (/interview|onsite|on-site/.test(s)) return "interview";
  if (/screen|review|phone|assess|shortlist/.test(s)) return "screen";
  if (/submit|present|sent\s*to\s*client/.test(s)) return "submitted";
  return "new";
}
