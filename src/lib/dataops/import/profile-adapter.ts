// Compiles a declarative MappingProfile into an ImportAdapter. One generic
// extractor drives every tabular source; the profile supplies all the variable
// data. The produced adapter is indistinguishable from a hand-written one — it
// registers, detects, and emits the same canonical IR.

import {
  type ImportAdapter,
  type ImportProbe,
  type ImportProvenanceBase,
  type ImportSheet,
  cellStr,
  cellNum,
  normHeader,
  sheetHeaders,
  mapDataRows,
} from "./import-adapter";
import {
  type IRCandidate,
  type IRJob,
  type IRSubmission,
  type ImportProvenance,
  type RecruitingImportIR,
  RECRUITING_MAPPING_VERSION,
  RECRUITING_PARSER_VERSION,
  normalizeStage,
} from "./recruiting-ir";
import type { MappingProfile } from "./mapping-profile";

type Row = Record<string, unknown>;

/** First non-empty value in a fallback chain of canonical field keys. */
function firstStr(row: Row, fields: string[] | undefined): string | null {
  for (const f of fields ?? []) {
    const v = cellStr(row[f]);
    if (v) return v;
  }
  return null;
}

/** Name parts joined with a space; null when none are present. */
function joinName(row: Row, fields: string[] | undefined): string | null {
  const parts = (fields ?? []).map((f) => cellStr(row[f])).filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

/** Map a metadata spec (target key -> source field) to resolved string values. */
function mapMeta(row: Row, spec: Record<string, string> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [target, source] of Object.entries(spec ?? {})) out[target] = cellStr(row[source]);
  return out;
}

function findSheet(probe: ImportProbe, normName: string): ImportSheet | undefined {
  return probe.sheets.find((s) => normHeader(s.name) === normName);
}

/** The data sheet that satisfies the profile's detection signature, if any. */
function matchSheet(probe: ImportProbe, profile: MappingProfile): ImportSheet | undefined {
  const wantName = profile.detect.sheetName ? normHeader(profile.detect.sheetName) : undefined;
  return probe.sheets.find((s) => {
    if (wantName && normHeader(s.name) !== wantName) return false;
    const headers = sheetHeaders(s);
    return profile.detect.requiredHeaders.every((h) => headers.has(normHeader(h)));
  });
}

/** A flat key/value sheet projected to a plain object (e.g. LinkedIn Overview). */
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

export function makeProfileAdapter(profile: MappingProfile): ImportAdapter {
  const buildJob = (
    row: Row,
    provenance: ImportProvenance,
    overview: Record<string, string>,
    jobs: Map<string, IRJob>,
  ): IRJob | null => {
    const externalKey = firstStr(row, profile.job.key);
    if (!externalKey) return null;
    const existing = jobs.get(externalKey);
    if (existing) return existing;

    const externalIds = (profile.job.externalIds ?? [])
      .map(({ system, from }) => {
        const v = cellStr(row[from]);
        return v ? { system, id: v } : null;
      })
      .filter((x): x is { system: string; id: string } => x !== null);

    let compensation: IRJob["compensation"] = null;
    if (profile.job.compensation) {
      const c = profile.job.compensation;
      const min = c.min ? cellNum(row[c.min]) : null;
      const max = c.max ? cellNum(row[c.max]) : null;
      const currency = c.currency ? cellStr(row[c.currency]) : null;
      const period = c.period ? cellStr(row[c.period]) : null;
      if (min != null || max != null || currency != null || period != null) {
        compensation = { min, max, currency, period };
      }
    }

    let hiringProject: IRJob["hiringProject"] = null;
    if (profile.job.hiringProject) {
      const id = profile.job.hiringProject.id ? cellStr(row[profile.job.hiringProject.id]) : null;
      const title = profile.job.hiringProject.title ? cellStr(row[profile.job.hiringProject.title]) : null;
      if (id || title) hiringProject = { id, title };
    }

    let contract: IRJob["contract"] = null;
    if (profile.job.contract) {
      const id = profile.job.contract.id ? cellStr(row[profile.job.contract.id]) : null;
      const name = profile.job.contract.name ? cellStr(row[profile.job.contract.name]) : null;
      if (id || name) contract = { id, name };
    }

    const metadata = mapMeta(row, profile.job.metadata);
    if (profile.overviewSheet) metadata.overview = overview;

    const job: IRJob = {
      externalKey,
      source: profile.source,
      title: profile.job.title ? cellStr(row[profile.job.title]) : null,
      url: profile.job.url ? cellStr(row[profile.job.url]) : null,
      externalIds,
      location: profile.job.location ? cellStr(row[profile.job.location]) : null,
      compensation,
      hiringProject,
      contract,
      provenance,
      metadata,
    };
    jobs.set(externalKey, job);
    return job;
  };

  const buildCandidate = (
    row: Row,
    provenance: ImportProvenance,
    candidates: Map<string, IRCandidate>,
  ): IRCandidate | null => {
    const fullName = joinName(row, profile.candidate.fullName);
    const externalKey = firstStr(row, profile.candidate.key) ?? fullName;
    if (!externalKey) return null;
    const existing = candidates.get(externalKey);
    if (existing) return existing;

    const c = profile.candidate;
    let education: IRCandidate["education"] = null;
    if (c.education) {
      const degree = c.education.degree ? cellStr(row[c.education.degree]) : null;
      const institution = c.education.institution ? cellStr(row[c.education.institution]) : null;
      if (degree || institution) education = { degree, institution };
    }

    const candidate: IRCandidate = {
      externalKey,
      source: profile.source,
      fullName,
      email: c.email ? cellStr(row[c.email]) : null,
      phone: c.phone ? cellStr(row[c.phone]) : null,
      location: c.location ? cellStr(row[c.location]) : null,
      headline: c.headline ? cellStr(row[c.headline]) : null,
      currentTitle: c.currentTitle ? cellStr(row[c.currentTitle]) : null,
      currentCompany: c.currentCompany ? cellStr(row[c.currentCompany]) : null,
      profileUrl: c.profileUrl ? cellStr(row[c.profileUrl]) : null,
      education,
      provenance,
      metadata: mapMeta(row, c.metadata),
    };
    candidates.set(externalKey, candidate);
    return candidate;
  };

  const buildSubmission = (
    row: Row,
    provenance: ImportProvenance,
    jobKey: string,
    candidateKey: string,
  ): IRSubmission => {
    const s = profile.submission;
    const rawStage = s.stage ? cellStr(row[s.stage]) : null;
    return {
      externalKey: `${jobKey}::${candidateKey}`,
      source: profile.source,
      jobKey,
      candidateKey,
      appliedAt: s.appliedAt ? cellStr(row[s.appliedAt]) : null,
      stage: normalizeStage(rawStage),
      rawStage,
      screeningAnswers: s.screening ? cellStr(row[s.screening]) : null,
      provenance,
      metadata: mapMeta(row, s.metadata),
    };
  };

  return {
    key: profile.source,
    source: profile.source,

    detect: (probe: ImportProbe): boolean => matchSheet(probe, profile) !== undefined,

    extract: (probe: ImportProbe, base: ImportProvenanceBase): RecruitingImportIR => {
      const sheet = matchSheet(probe, profile)!;
      const overview = profile.overviewSheet
        ? readOverview(findSheet(probe, normHeader(profile.overviewSheet)))
        : {};

      const prov = (rowNumber: number | null): ImportProvenance => ({
        source: profile.source,
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

      for (const { row, rowNumber } of mapDataRows(sheet, profile.columns)) {
        const provenance = prov(rowNumber);
        const job = buildJob(row, provenance, overview, jobs);
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
}
