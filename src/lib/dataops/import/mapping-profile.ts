// Declarative mapping profile for flat tabular recruiting exports.
//
// Most ATS "export to spreadsheet" features produce the same shape: one sheet,
// one row per application, columns for the candidate AND the job. Such a source
// differs from another ONLY in data — detection signature, column labels, and
// which column is the canonical key. A MappingProfile captures exactly that, so
// a new source is ~20 lines of config compiled into an ImportAdapter by
// `makeProfileAdapter`, not a new hand-written adapter.
//
// This is deliberately NOT universal: sources that need real logic (API
// pagination, multi-sheet joins, nested JSON, computed/conditional fields) stay
// as code adapters behind the same ImportAdapter interface. Profiles cover the
// common tabular case; code adapters cover the long tail.

/** A field group whose object is emitted only if at least one part is present. */
export interface CompensationSpec {
  min?: string;
  max?: string;
  currency?: string;
  period?: string;
}

export interface JobSpec {
  /** Canonical-key fallback chain for the job's externalKey (first present wins). */
  key: string[];
  title?: string;
  url?: string;
  location?: string;
  /** Foreign ids; each is emitted only when its source column has a value. */
  externalIds?: Array<{ system: string; from: string }>;
  compensation?: CompensationSpec;
  hiringProject?: { id?: string; title?: string };
  contract?: { id?: string; name?: string };
  /** Extra raw fields kept on metadata: target key -> source canonical key. */
  metadata?: Record<string, string>;
}

export interface CandidateSpec {
  /** externalKey fallback chain; falls back to the computed full name if empty. */
  key: string[];
  /** Name parts joined with a space (e.g. ["firstName","lastName"] or ["candidateName"]). */
  fullName?: string[];
  email?: string;
  phone?: string;
  location?: string;
  headline?: string;
  currentTitle?: string;
  currentCompany?: string;
  profileUrl?: string;
  education?: { degree?: string; institution?: string };
  metadata?: Record<string, string>;
}

export interface SubmissionSpec {
  stage?: string;
  appliedAt?: string;
  screening?: string;
  metadata?: Record<string, string>;
}

export interface MappingProfile {
  /** Source attribution stamped onto every emitted entity, e.g. "greenhouse". */
  source: string;
  /** How to recognize the format and pick the data sheet. */
  detect: {
    /** Optional sheet-name match (normalized) — required when set. */
    sheetName?: string;
    /** Normalized header labels that must all be present on the data sheet. */
    requiredHeaders: string[];
  };
  /** Optional flat key/value sheet (e.g. LinkedIn "Overview"); attached to each
   *  job's metadata.overview and the import document. */
  overviewSheet?: string;
  /** Source header label (normalized) -> canonical field key. */
  columns: Record<string, string>;
  job: JobSpec;
  candidate: CandidateSpec;
  submission: SubmissionSpec;
}
