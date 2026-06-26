// Greenhouse "Candidates / Applications" export adapter.
//
// A second, intentionally different source shape that exercises the framework:
// a SINGLE-sheet export (CSV or XLSX) with Greenhouse's own column vocabulary.
// It maps onto the exact same canonical Recruiting IR as the LinkedIn adapter —
// proving that adding an ATS is one adapter, never an ontology change.
//
// Canonical keys: Job <- Requisition ID (Greenhouse's), Candidate <- Email,
// Submission <- one application row.

import {
  type ImportAdapter,
  type ImportProbe,
  type ImportProvenanceBase,
  type ImportSheet,
  cellStr,
  mapDataRows,
  sheetHeaders,
} from "../import-adapter";
import {
  type IRCandidate,
  type IRJob,
  type IRSubmission,
  type ImportProvenance,
  type RecruitingImportIR,
  RECRUITING_MAPPING_VERSION,
  RECRUITING_PARSER_VERSION,
  normalizeStage,
} from "../recruiting-ir";

const SOURCE = "greenhouse";

const COLUMN_MAP: Record<string, string> = {
  "candidate name": "candidateName",
  "first name": "firstName",
  "last name": "lastName",
  email: "email",
  "email address": "email",
  phone: "phone",
  "phone number": "phone",
  location: "location",
  "job name": "jobName",
  "requisition id": "requisitionId",
  "opening id": "openingId",
  stage: "stage",
  "current stage": "stage",
  "applied at": "appliedAt",
  "application date": "appliedAt",
  source: "sourceName",
  recruiter: "recruiter",
  coordinator: "coordinator",
  "job post url": "jobUrl",
};

/** First sheet whose header row carries the Greenhouse signature columns. */
function signatureSheet(probe: ImportProbe): ImportSheet | undefined {
  return probe.sheets.find((s) => {
    const h = sheetHeaders(s);
    return h.has("requisition id") && (h.has("candidate name") || h.has("email")) && h.has("stage");
  });
}

export const greenhouseAdapter: ImportAdapter = {
  key: SOURCE,
  source: SOURCE,

  detect(probe: ImportProbe): boolean {
    return signatureSheet(probe) !== undefined;
  },

  extract(probe: ImportProbe, base: ImportProvenanceBase): RecruitingImportIR {
    const sheet = signatureSheet(probe)!;

    const prov = (rowNumber: number | null): ImportProvenance => ({
      source: SOURCE,
      importRunId: base.importRunId,
      importedAt: base.importedAt,
      originalFilename: base.originalFilename,
      workbookHash: base.workbookHash,
      sheetName: sheet.name,
      rowNumber,
      parserVersion: RECRUITING_PARSER_VERSION,
      mappingVersion: RECRUITING_MAPPING_VERSION,
    });

    const jobs = new Map<string, IRJob>();
    const candidates = new Map<string, IRCandidate>();
    const submissions: IRSubmission[] = [];

    for (const { row, rowNumber } of mapDataRows(sheet, COLUMN_MAP)) {
      const provenance = prov(rowNumber);
      const job = buildJob(row, provenance, jobs);
      const candidate = buildCandidate(row, provenance, candidates);
      if (!job || !candidate) continue;
      submissions.push(buildSubmission(row, provenance, job.externalKey, candidate.externalKey));
    }

    return {
      provenance: prov(null),
      jobs: [...jobs.values()],
      candidates: [...candidates.values()],
      submissions,
    };
  },
};

function buildJob(
  row: Record<string, unknown>,
  provenance: ImportProvenance,
  jobs: Map<string, IRJob>,
): IRJob | null {
  const requisitionId = cellStr(row.requisitionId);
  if (!requisitionId) return null;

  const existing = jobs.get(requisitionId);
  if (existing) return existing;

  const job: IRJob = {
    externalKey: requisitionId,
    source: SOURCE,
    title: cellStr(row.jobName),
    url: cellStr(row.jobUrl),
    externalIds: [{ system: "greenhouse", id: requisitionId }],
    location: cellStr(row.location),
    compensation: null,
    hiringProject: null,
    contract: null,
    provenance,
    metadata: { openingId: cellStr(row.openingId) },
  };
  jobs.set(requisitionId, job);
  return job;
}

function buildCandidate(
  row: Record<string, unknown>,
  provenance: ImportProvenance,
  candidates: Map<string, IRCandidate>,
): IRCandidate | null {
  const email = cellStr(row.email);
  const named = cellStr(row.candidateName);
  const split = [cellStr(row.firstName), cellStr(row.lastName)].filter(Boolean).join(" ") || null;
  const fullName = named ?? split;
  const externalKey = email ?? fullName;
  if (!externalKey) return null;

  const existing = candidates.get(externalKey);
  if (existing) return existing;

  const candidate: IRCandidate = {
    externalKey,
    source: SOURCE,
    fullName,
    email,
    phone: cellStr(row.phone),
    location: cellStr(row.location),
    headline: null,
    currentTitle: null,
    currentCompany: null,
    profileUrl: null,
    education: null,
    provenance,
    metadata: { source: cellStr(row.sourceName) },
  };
  candidates.set(externalKey, candidate);
  return candidate;
}

function buildSubmission(
  row: Record<string, unknown>,
  provenance: ImportProvenance,
  jobKey: string,
  candidateKey: string,
): IRSubmission {
  const rawStage = cellStr(row.stage);
  return {
    externalKey: `${jobKey}::${candidateKey}`,
    source: SOURCE,
    jobKey,
    candidateKey,
    appliedAt: cellStr(row.appliedAt),
    stage: normalizeStage(rawStage),
    rawStage,
    screeningAnswers: null,
    provenance,
    metadata: {
      recruiter: cellStr(row.recruiter),
      coordinator: cellStr(row.coordinator),
      source: cellStr(row.sourceName),
    },
  };
}
