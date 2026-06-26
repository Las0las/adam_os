// Natural-language job extraction (paste-a-JD → draft → review).
//
// A recruiter pastes an unstructured job description; a model extracts the job
// fields. Like candidate extraction, it NEVER auto-commits: it lands as a
// non-authoritative `JobExtraction` staging object plus a review case. A reviewer
// confirms (which projects a real Job) or rejects (no Job created). Same
// governance — permissions + audit — as every other write.

import { createHash } from "node:crypto";
import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import {
  extractJobFields,
  JOB_STRING_FIELDS,
} from "@/lib/aiops/functions/builtins/extract-job-fields";
import { upsertObject, type AppendLedgerEntry } from "@/lib/dataops/ontology/object-service";
import { openReviewCase, resolveReviewCase } from "@/lib/mission-control/review-queue/review-service";
import {
  type IRJob,
  type ImportProvenance,
  RECRUITING_MAPPING_VERSION,
  RECRUITING_PARSER_VERSION,
} from "../recruiting-ir";
import type { ActorContext } from "@/types/platform";
import type { OntologyObject } from "@/types/dataops";
import type { ReviewCase } from "@/types/mission-control";

const DRAFT_OBJECT_TYPE = "JobExtraction";
/** Review case type for JD extraction drafts; the resolve route keys on this. */
export const JOB_EXTRACTION_CASE_TYPE = "job_extraction";
const DEFAULT_SOURCE = "pasted_jd";

function str(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/[, $]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function slug(value: string | null): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Derived canonical key so re-pasting the same JD updates rather than dupes.
 *  A pasted JD has no external id; we key on title + company. */
function deriveJobKey(title: string | null, company: string | null): string {
  const t = slug(title);
  const c = slug(company);
  return c ? `paste:${t}@${c}` : `paste:${t}`;
}

function importsLedger(provenance: ImportProvenance): AppendLedgerEntry[] {
  return [{ prop: "imports", entry: provenance as unknown as Record<string, unknown>, dedupeKey: "importRunId" }];
}

export interface ExtractJobInput {
  text: string;
  source?: string;
}

export interface JobDraftResult {
  extraction: OntologyObject;
  reviewCase: ReviewCase;
  proposed: IRJob;
  confidence: number;
}

/** Extract a job from a pasted JD and stage it for review. Writes a
 *  non-authoritative `JobExtraction` object + review case; does NOT create a Job.
 *  Requires ontology.admin (it persists a staging object). */
export async function extractJobDraft(ctx: ActorContext, input: ExtractJobInput): Promise<JobDraftResult> {
  requirePermission(ctx, "ontology.admin");
  const text = input.text?.trim() ?? "";
  if (!text) throw new Error("no text provided to extract a job from");
  const source = input.source?.trim() || DEFAULT_SOURCE;

  const { fields, provider: modelProvider, modelKey } = await extractJobFields(ctx, text);

  const title = str(fields.title);
  if (!title) throw new Error("could not extract an identifiable job (no title)");
  const company = str(fields.company);
  const externalKey = deriveJobKey(title, company);

  const provenance: ImportProvenance = {
    source,
    importRunId: id("jobextract"),
    importedAt: now(),
    originalFilename: null,
    workbookHash: createHash("sha256").update(text).digest("hex"),
    sheetName: null,
    rowNumber: null,
    parserVersion: RECRUITING_PARSER_VERSION,
    mappingVersion: RECRUITING_MAPPING_VERSION,
  };

  const min = num(fields.minSalary);
  const max = num(fields.maxSalary);
  const currency = str(fields.currency);
  const period = str(fields.compensationPeriod);
  const hasComp = min != null || max != null || currency != null || period != null;

  const proposed: IRJob = {
    externalKey,
    source,
    title,
    url: null,
    externalIds: [],
    location: str(fields.location),
    compensation: hasComp ? { min, max, currency, period } : null,
    hiringProject: null,
    contract: null,
    provenance,
    metadata: {
      company,
      employmentType: str(fields.employmentType),
      seniority: str(fields.seniority),
      requirements: str(fields.requirements),
      summary: str(fields.summary),
    },
  };

  const filled = JOB_STRING_FIELDS.filter((f) => str(fields[f])).length;
  const confidence = Number((filled / JOB_STRING_FIELDS.length).toFixed(2));

  const extraction = await upsertObject(ctx, {
    objectType: DRAFT_OBJECT_TYPE,
    externalKey: provenance.importRunId, // one staging object per extraction
    title,
    status: "pending_review",
    properties: {
      proposed,
      confidence,
      source,
      model: { provider: modelProvider, modelKey },
      sourceText: text.slice(0, 4000),
      provenance,
    },
  });

  const reviewCase = await openReviewCase(ctx, {
    caseType: JOB_EXTRACTION_CASE_TYPE,
    subject: { type: DRAFT_OBJECT_TYPE, id: extraction.id },
    severity: confidence < 0.5 ? "high" : "medium",
    summary: `Proposed job "${title}"${company ? ` at ${company}` : ""} extracted from ${source} (confidence ${confidence}).`,
  });

  await emitAudit(ctx, "recruiting.job.extracted", { type: DRAFT_OBJECT_TYPE, id: extraction.id }, {
    source,
    confidence,
    reviewCaseId: reviewCase.id,
  });

  return { extraction, reviewCase, proposed, confidence };
}

async function loadPendingExtraction(ctx: ActorContext, reviewCaseId: string) {
  const reviewCase = await db.reviewCases.get(ctx.tenantId, reviewCaseId);
  if (!reviewCase || reviewCase.caseType !== JOB_EXTRACTION_CASE_TYPE) {
    throw new Error(`Not a job-extraction review case: ${reviewCaseId}`);
  }
  if (reviewCase.status !== "open" && reviewCase.status !== "in_review") {
    throw new Error(`Review case already ${reviewCase.status}: ${reviewCaseId}`);
  }
  const extraction = reviewCase.subjectObjectId
    ? await db.ontologyObjects.get(ctx.tenantId, reviewCase.subjectObjectId)
    : undefined;
  if (!extraction || extraction.objectType !== DRAFT_OBJECT_TYPE) {
    throw new Error(`Extraction draft not found for review case: ${reviewCaseId}`);
  }
  return { reviewCase, extraction };
}

/** Confirm a JD extraction: project the proposed fields into a real Job
 *  (idempotent on the derived key, with append-only provenance) and approve the
 *  review case. Requires review.reviewer. */
export async function confirmJobDraft(
  ctx: ActorContext,
  reviewCaseId: string,
  note?: string,
): Promise<OntologyObject> {
  requirePermission(ctx, "review.reviewer");
  const { extraction } = await loadPendingExtraction(ctx, reviewCaseId);
  const proposed = extraction.properties.proposed as IRJob;

  const job = await upsertObject(ctx, {
    objectType: "Job",
    externalKey: proposed.externalKey,
    title: proposed.title ?? proposed.externalKey,
    status: "open",
    properties: {
      source: proposed.source,
      title: proposed.title,
      location: proposed.location,
      compensation: proposed.compensation,
      company: proposed.metadata.company ?? null,
      employmentType: proposed.metadata.employmentType ?? null,
      seniority: proposed.metadata.seniority ?? null,
      requirements: proposed.metadata.requirements ?? null,
      summary: proposed.metadata.summary ?? null,
      provenance: proposed.provenance,
    },
    appendLedger: importsLedger(proposed.provenance),
  });

  await db.ontologyObjects.update(extraction.id, {
    status: "approved",
    properties: { ...extraction.properties, jobId: job.id },
    updatedAt: now(),
  });
  await resolveReviewCase(ctx, reviewCaseId, "approved", note);
  await emitAudit(ctx, "recruiting.job.extraction_confirmed", { type: "Job", id: job.id }, {
    reviewCaseId,
    extractionId: extraction.id,
  });
  return job;
}

/** Reject a JD extraction: no Job is created; the draft is marked rejected and
 *  the review case closed. Requires review.reviewer. */
export async function rejectJobDraft(ctx: ActorContext, reviewCaseId: string, note?: string): Promise<void> {
  requirePermission(ctx, "review.reviewer");
  const { extraction } = await loadPendingExtraction(ctx, reviewCaseId);
  await db.ontologyObjects.update(extraction.id, { status: "rejected", updatedAt: now() });
  await resolveReviewCase(ctx, reviewCaseId, "rejected", note);
  await emitAudit(ctx, "recruiting.job.extraction_rejected", { type: DRAFT_OBJECT_TYPE, id: extraction.id }, {
    reviewCaseId,
  });
}
