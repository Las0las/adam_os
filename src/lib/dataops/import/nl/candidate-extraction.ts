// Natural-language candidate extraction (paste-a-profile → draft → review).
//
// A recruiter pastes an unstructured LinkedIn/CV profile; a model extracts the
// candidate fields against a schema. Because NL extraction is probabilistic, the
// result NEVER auto-commits to the authoritative ontology: it lands as a
// `CandidateExtraction` staging object plus a review-queue case. A reviewer
// confirms (which projects a real Candidate, with append-only provenance) or
// rejects (no Candidate created). Same governance — permissions + audit — as
// every other write.

import { createHash } from "node:crypto";
import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import { getModelProvider } from "@/lib/aiops/models/model-provider";
import { upsertObject, type AppendLedgerEntry } from "@/lib/dataops/ontology/object-service";
import { openReviewCase, resolveReviewCase } from "@/lib/mission-control/review-queue/review-service";
import {
  type IRCandidate,
  type ImportProvenance,
  RECRUITING_MAPPING_VERSION,
  RECRUITING_PARSER_VERSION,
} from "../recruiting-ir";
import type { ActorContext } from "@/types/platform";
import type { OntologyObject } from "@/types/dataops";
import type { ReviewCase } from "@/types/mission-control";

const DRAFT_OBJECT_TYPE = "CandidateExtraction";
const REVIEW_CASE_TYPE = "candidate_extraction";
const DEFAULT_SOURCE = "pasted_profile";

/** Schema the model extracts against. Kept flat to match a profile/CV's fields. */
const CANDIDATE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    fullName: { type: "string" },
    email: { type: "string" },
    phone: { type: "string" },
    location: { type: "string" },
    headline: { type: "string" },
    currentTitle: { type: "string" },
    currentCompany: { type: "string" },
    profileUrl: { type: "string" },
    educationDegree: { type: "string" },
    educationInstitution: { type: "string" },
    summary: { type: "string" },
  },
};

const STRING_FIELDS = [
  "fullName",
  "email",
  "phone",
  "location",
  "headline",
  "currentTitle",
  "currentCompany",
  "profileUrl",
  "educationDegree",
  "educationInstitution",
] as const;

function str(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

function importsLedger(provenance: ImportProvenance): AppendLedgerEntry[] {
  return [{ prop: "imports", entry: provenance as unknown as Record<string, unknown>, dedupeKey: "importRunId" }];
}

export interface ExtractCandidateInput {
  text: string;
  /** Provenance source label (default "pasted_profile"); e.g. "chat". */
  source?: string;
}

export interface CandidateDraftResult {
  extraction: OntologyObject;
  reviewCase: ReviewCase;
  proposed: IRCandidate;
  confidence: number;
}

/**
 * Extract a candidate from free text and stage it for human review. Writes a
 * non-authoritative `CandidateExtraction` object and opens a review case; does
 * NOT create a Candidate. Requires ontology.admin (it persists a staging object).
 */
export async function extractCandidateDraft(
  ctx: ActorContext,
  input: ExtractCandidateInput,
): Promise<CandidateDraftResult> {
  requirePermission(ctx, "ontology.admin");
  const text = input.text?.trim() ?? "";
  if (!text) throw new Error("no text provided to extract a candidate from");
  const source = input.source?.trim() || DEFAULT_SOURCE;

  const completion = await getModelProvider().complete({
    prompt:
      "Extract the candidate's contact and profile fields as JSON from the text " +
      "below. Use only information present in the text; leave a field empty if it " +
      `is not stated. Do not invent values.\n\n${text.slice(0, 6000)}`,
    outputSchema: CANDIDATE_SCHEMA,
  });
  const fields = completion.json ?? {};

  const fullName = str(fields.fullName);
  const email = str(fields.email);
  const profileUrl = str(fields.profileUrl);
  const externalKey = email ?? profileUrl ?? fullName;
  if (!externalKey) {
    throw new Error("could not extract an identifiable candidate (no name, email, or profile URL)");
  }

  const provenance: ImportProvenance = {
    source,
    importRunId: id("extract"),
    importedAt: now(),
    originalFilename: null,
    workbookHash: createHash("sha256").update(text).digest("hex"),
    sheetName: null,
    rowNumber: null,
    parserVersion: RECRUITING_PARSER_VERSION,
    mappingVersion: RECRUITING_MAPPING_VERSION,
  };

  const degree = str(fields.educationDegree);
  const institution = str(fields.educationInstitution);
  const proposed: IRCandidate = {
    externalKey,
    source,
    fullName,
    email,
    phone: str(fields.phone),
    location: str(fields.location),
    headline: str(fields.headline),
    currentTitle: str(fields.currentTitle),
    currentCompany: str(fields.currentCompany),
    profileUrl,
    education: degree || institution ? { degree, institution } : null,
    provenance,
    metadata: { summary: str(fields.summary) },
  };

  // Heuristic confidence: fraction of profile fields the model populated.
  const filled = STRING_FIELDS.filter((f) => str(fields[f])).length;
  const confidence = Number((filled / STRING_FIELDS.length).toFixed(2));

  const extraction = await upsertObject(ctx, {
    objectType: DRAFT_OBJECT_TYPE,
    externalKey: provenance.importRunId, // one staging object per extraction
    title: fullName ?? email ?? externalKey,
    status: "pending_review",
    properties: {
      proposed,
      confidence,
      source,
      model: { provider: completion.provider, modelKey: completion.modelKey },
      sourceText: text.slice(0, 4000),
      provenance,
    },
  });

  const reviewCase = await openReviewCase(ctx, {
    caseType: REVIEW_CASE_TYPE,
    subject: { type: DRAFT_OBJECT_TYPE, id: extraction.id },
    severity: confidence < 0.5 ? "high" : "medium",
    summary: `Proposed candidate "${fullName ?? externalKey}" extracted from ${source} (confidence ${confidence}).`,
  });

  await emitAudit(ctx, "recruiting.candidate.extracted", { type: DRAFT_OBJECT_TYPE, id: extraction.id }, {
    source,
    confidence,
    reviewCaseId: reviewCase.id,
  });

  return { extraction, reviewCase, proposed, confidence };
}

async function loadPendingExtraction(ctx: ActorContext, reviewCaseId: string) {
  const reviewCase = await db.reviewCases.get(ctx.tenantId, reviewCaseId);
  if (!reviewCase || reviewCase.caseType !== REVIEW_CASE_TYPE) {
    throw new Error(`Not a candidate-extraction review case: ${reviewCaseId}`);
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

/**
 * Confirm an extraction: project the proposed fields into a real Candidate
 * (idempotent on email/profile key, with append-only provenance) and approve the
 * review case. Requires review.reviewer.
 */
export async function confirmCandidateDraft(
  ctx: ActorContext,
  reviewCaseId: string,
  note?: string,
): Promise<OntologyObject> {
  requirePermission(ctx, "review.reviewer");
  const { extraction } = await loadPendingExtraction(ctx, reviewCaseId);
  const proposed = extraction.properties.proposed as IRCandidate;

  const candidate = await upsertObject(ctx, {
    objectType: "Candidate",
    externalKey: proposed.externalKey,
    title: proposed.fullName ?? proposed.email ?? proposed.externalKey,
    status: "new",
    properties: {
      source: proposed.source,
      fullName: proposed.fullName,
      email: proposed.email,
      phone: proposed.phone,
      location: proposed.location,
      headline: proposed.headline,
      currentTitle: proposed.currentTitle,
      currentCompany: proposed.currentCompany,
      profileUrl: proposed.profileUrl,
      education: proposed.education,
      summary: proposed.metadata.summary ?? null,
      provenance: proposed.provenance,
    },
    appendLedger: importsLedger(proposed.provenance),
  });

  await db.ontologyObjects.update(extraction.id, {
    status: "approved",
    properties: { ...extraction.properties, candidateId: candidate.id },
    updatedAt: now(),
  });
  await resolveReviewCase(ctx, reviewCaseId, "approved", note);
  await emitAudit(ctx, "recruiting.candidate.extraction_confirmed", { type: "Candidate", id: candidate.id }, {
    reviewCaseId,
    extractionId: extraction.id,
  });
  return candidate;
}

/** Reject an extraction: no Candidate is created; the draft is marked rejected
 *  and the review case closed. Requires review.reviewer. */
export async function rejectCandidateDraft(
  ctx: ActorContext,
  reviewCaseId: string,
  note?: string,
): Promise<void> {
  requirePermission(ctx, "review.reviewer");
  const { extraction } = await loadPendingExtraction(ctx, reviewCaseId);
  await db.ontologyObjects.update(extraction.id, { status: "rejected", updatedAt: now() });
  await resolveReviewCase(ctx, reviewCaseId, "rejected", note);
  await emitAudit(ctx, "recruiting.candidate.extraction_rejected", { type: DRAFT_OBJECT_TYPE, id: extraction.id }, {
    reviewCaseId,
  });
}
