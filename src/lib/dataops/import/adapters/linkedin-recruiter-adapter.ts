// LinkedIn Recruiter "Job Applicant Report" adapter.
//
// LinkedIn exports a 2-tab XLSX: an "Overview" tab (report-level metadata) and a
// "Job Applicants" tab (one row per applicant, carrying both candidate fields
// and the job's metadata). This adapter projects that into the canonical IR:
//   - one Job per LinkedIn Job ID  (ATS Job ID kept as an external reference)
//   - one Candidate per applicant  (keyed on email, fallback profile URL/name)
//   - one Submission per row        (the application lifecycle object)
//
// Matching is by header LABEL, not column index, so column reordering or added
// columns do not break ingestion; unknown columns are preserved on metadata.

import {
  type ImportAdapter,
  type ImportProbe,
  type ImportProvenanceBase,
  type ImportSheet,
  cellStr,
  cellNum,
  normHeader,
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

const SOURCE = "linkedin_recruiter";
const APPLICANTS_SHEET = "job applicants";
const OVERVIEW_SHEET = "overview";

// Canonical field key for each known LinkedIn column header (normalized label).
const COLUMN_MAP: Record<string, string> = {
  "first name": "firstName",
  "last name": "lastName",
  "email address": "email",
  "phone number": "phone",
  "general location": "location",
  "zip code": "zipCode",
  headline: "headline",
  "current title": "currentTitle",
  "current company": "currentCompany",
  "current position start date": "currentPositionStartDate",
  "education degree": "educationDegree",
  "education institution": "educationInstitution",
  "profile url": "profileUrl",
  "date applied": "dateApplied",
  "current stage": "currentStage",
  "job id": "jobId",
  "job title": "jobTitle",
  "job url": "jobUrl",
  "ats job id": "atsJobId",
  "minimum salary": "minSalary",
  "maximum salary": "maxSalary",
  "currency code": "currencyCode",
  "compensation period": "compensationPeriod",
  "hiring project id": "hiringProjectId",
  "hiring project title": "hiringProjectTitle",
  "contract id": "contractId",
  "contract name": "contractName",
  "screening questions": "screeningQuestions",
};

function findSheet(probe: ImportProbe, normName: string): ImportSheet | undefined {
  return probe.sheets.find((s) => normHeader(s.name) === normName);
}

export const linkedinRecruiterAdapter: ImportAdapter = {
  key: SOURCE,
  source: SOURCE,

  detect(probe: ImportProbe): boolean {
    const sheet = findSheet(probe, APPLICANTS_SHEET);
    if (!sheet) return false;
    const headers = sheetHeaders(sheet);
    // Require the signature columns that make this unambiguously the export.
    return headers.has("first name") && headers.has("email address") && headers.has("job id");
  },

  extract(probe: ImportProbe, base: ImportProvenanceBase): RecruitingImportIR {
    const sheet = findSheet(probe, APPLICANTS_SHEET)!;
    const overview = readOverview(findSheet(probe, OVERVIEW_SHEET));

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
      const job = buildJob(row, provenance, overview, jobs);
      const candidate = buildCandidate(row, provenance, candidates);
      if (!job || !candidate) continue; // need both to form a submission
      submissions.push(buildSubmission(row, provenance, job.externalKey, candidate.externalKey));
    }

    return {
      provenance: {
        source: SOURCE,
        importRunId: base.importRunId,
        importedAt: base.importedAt,
        originalFilename: base.originalFilename,
        workbookHash: base.workbookHash,
        sheetName: sheet.name,
        rowNumber: null,
        parserVersion: RECRUITING_PARSER_VERSION,
        mappingVersion: RECRUITING_MAPPING_VERSION,
      },
      jobs: [...jobs.values()],
      candidates: [...candidates.values()],
      submissions,
    };
  },
};

/** Overview tab is a flat key/value table; project it to a plain object. */
function readOverview(sheet: ImportSheet | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!sheet) return out;
  for (const r of sheet.rows) {
    if (!Array.isArray(r)) continue;
    const k = cellStr(r[0]);
    const v = cellStr(r[1]);
    if (k && v) out[k] = v;
  }
  return out;
}

function buildJob(
  row: Record<string, unknown>,
  provenance: ImportProvenance,
  overview: Record<string, string>,
  jobs: Map<string, IRJob>,
): IRJob | null {
  const jobId = cellStr(row.jobId);
  const atsJobId = cellStr(row.atsJobId);
  const externalKey = jobId ?? atsJobId; // canonical = LinkedIn Job ID
  if (!externalKey) return null;

  const existing = jobs.get(externalKey);
  if (existing) return existing;

  const externalIds = [
    jobId ? { system: "linkedin", id: jobId } : null,
    atsJobId ? { system: "ats", id: atsJobId } : null,
  ].filter((x): x is { system: string; id: string } => x !== null);

  const min = cellNum(row.minSalary);
  const max = cellNum(row.maxSalary);
  const currency = cellStr(row.currencyCode);
  const period = cellStr(row.compensationPeriod);
  const hasComp = min != null || max != null || currency != null || period != null;

  const job: IRJob = {
    externalKey,
    source: SOURCE,
    title: cellStr(row.jobTitle),
    url: cellStr(row.jobUrl),
    externalIds,
    location: cellStr(row.location),
    compensation: hasComp ? { min, max, currency, period } : null,
    hiringProject:
      cellStr(row.hiringProjectId) || cellStr(row.hiringProjectTitle)
        ? { id: cellStr(row.hiringProjectId), title: cellStr(row.hiringProjectTitle) }
        : null,
    contract:
      cellStr(row.contractId) || cellStr(row.contractName)
        ? { id: cellStr(row.contractId), name: cellStr(row.contractName) }
        : null,
    provenance,
    metadata: { atsJobId, overview },
  };
  jobs.set(externalKey, job);
  return job;
}

function buildCandidate(
  row: Record<string, unknown>,
  provenance: ImportProvenance,
  candidates: Map<string, IRCandidate>,
): IRCandidate | null {
  const email = cellStr(row.email);
  const first = cellStr(row.firstName);
  const last = cellStr(row.lastName);
  const fullName = [first, last].filter(Boolean).join(" ") || null;
  const profileUrl = cellStr(row.profileUrl);
  const externalKey = email ?? profileUrl ?? fullName;
  if (!externalKey) return null;

  const existing = candidates.get(externalKey);
  if (existing) return existing;

  const degree = cellStr(row.educationDegree);
  const institution = cellStr(row.educationInstitution);

  const candidate: IRCandidate = {
    externalKey,
    source: SOURCE,
    fullName,
    email,
    phone: cellStr(row.phone),
    location: cellStr(row.location),
    headline: cellStr(row.headline),
    currentTitle: cellStr(row.currentTitle),
    currentCompany: cellStr(row.currentCompany),
    profileUrl,
    education: degree || institution ? { degree, institution } : null,
    provenance,
    metadata: {
      zipCode: cellStr(row.zipCode),
      currentPositionStartDate: cellStr(row.currentPositionStartDate),
    },
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
  const rawStage = cellStr(row.currentStage);
  return {
    externalKey: `${jobKey}::${candidateKey}`,
    source: SOURCE,
    jobKey,
    candidateKey,
    appliedAt: cellStr(row.dateApplied),
    stage: normalizeStage(rawStage),
    rawStage,
    screeningAnswers: cellStr(row.screeningQuestions),
    provenance,
    metadata: {},
  };
}
