// Phase 4 CLAIMS — validation-case evidence-summary reasoning function. Grounds
// a disposition on retrieved evidence, derives deterministic findings (missing
// evidence / conflicting amount / missing signature), and fails closed when
// neither a ValidationCase nor a ClaimDocument fallback exists. Self-registers.

import { z } from "zod";
import { registerFunction } from "@/lib/aiops/functions/function-registry";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { retrieve } from "@/lib/aiops/retrieval/retrieval-service";
import { getModelProvider } from "@/lib/aiops/models/model-provider";
import { validateOutput } from "@/lib/domains/domain-workflow-types";
import type { LawrenceFunction, FunctionExecutionResult } from "@/lib/aiops/functions/function-types";
import type { RetrievalHit } from "@/types/dataops";

const findingTypeSchema = z.enum([
  "missing_evidence",
  "conflicting_amount",
  "date_mismatch",
  "identity_mismatch",
  "unsupported_claim",
  "manual_review_required",
]);

const severitySchema = z.enum(["low", "medium", "high", "critical"]);

const dispositionSchema = z.enum([
  "validated",
  "needs_human_review",
  "failed",
  "request_more_info",
]);

const findingSchema = z.object({
  findingType: findingTypeSchema,
  severity: severitySchema,
  message: z.string(),
  evidenceRefs: z.array(z.unknown()),
});

const evidenceSummaryOutputSchema = z.object({
  summary: z.string(),
  confidence: z.number(),
  findings: z.array(findingSchema),
  recommendedDisposition: dispositionSchema,
});

export type ValidationFinding = z.infer<typeof findingSchema>;
export type EvidenceSummaryOutput = z.infer<typeof evidenceSummaryOutputSchema>;

interface EvidenceSummaryInput {
  validationCaseId: string;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** Pull every distinct currency-ish amount (e.g. 5000, 4,200, 4200.00). */
function amountsIn(text: string): string[] {
  const matches = text.match(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\b|\b\d+(?:\.\d+)?\b/g) ?? [];
  const normalized = matches
    .map((m) => m.replace(/,/g, ""))
    .map((m) => Number(m))
    .filter((n) => !Number.isNaN(n) && n >= 100); // ignore small numbers / years-ish noise
  return [...new Set(normalized.map((n) => String(n)))];
}

const evidenceSummary: LawrenceFunction<EvidenceSummaryInput, EvidenceSummaryOutput> = {
  key: "claims.validation_case_evidence_summary",
  name: "Validation case evidence summary",
  description:
    "Reason over a validation case's retrieved evidence, derive deterministic findings, and recommend a disposition.",
  klass: "reason",
  outputSchema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      confidence: { type: "number" },
      findings: { type: "array", items: { type: "object" } },
      recommendedDisposition: { type: "string" },
    },
    required: ["summary", "confidence", "findings", "recommendedDisposition"],
  },
  async run(ctx, input): Promise<FunctionExecutionResult<EvidenceSummaryOutput>> {
    const validationCaseId = String(input.validationCaseId);

    // Fail closed: a ValidationCase, or a ClaimDocument fallback, must exist.
    const validationCases = await listObjects(ctx, "ValidationCase");
    const subject =
      validationCases.find((c) => c.id === validationCaseId) ??
      (await listObjects(ctx, "ClaimDocument")).find((d) => d.id === validationCaseId);
    if (!subject) throw new Error("missing validation case");

    const { hits } = await retrieve(ctx, {
      tenantId: ctx.tenantId,
      query: "claim amount invoice date policy",
      objectTypes: ["ValidationCase", "ClaimDocument", "EmailMessage"],
      subjectObjectId: validationCaseId,
      methods: ["rank_fusion"],
      limit: 8,
    });

    const evidenceText = hits.map((h: RetrievalHit) => h.excerpt).join(" ");
    const evidenceRefs: unknown[] = hits.map((h: RetrievalHit) => ({
      objectType: h.objectType,
      objectId: h.objectId,
      chunkId: h.chunkId ?? null,
      excerpt: h.excerpt,
    }));

    const findings: ValidationFinding[] = [];

    // Deterministic finding 1: no evidence retrieved at all -> critical.
    if (hits.length === 0) {
      findings.push({
        findingType: "missing_evidence",
        severity: "critical",
        message: "No evidence could be retrieved for this validation case.",
        evidenceRefs: [],
      });
    } else {
      // Deterministic finding 2: two or more distinct amounts -> conflicting.
      const amounts = amountsIn(evidenceText);
      if (amounts.length >= 2) {
        findings.push({
          findingType: "conflicting_amount",
          severity: "high",
          message: `Conflicting amounts found in evidence: ${amounts.join(", ")}.`,
          evidenceRefs,
        });
      }

      // Deterministic finding 3: no signature / "signed" token -> medium.
      const lower = evidenceText.toLowerCase();
      if (!lower.includes("signature") && !lower.includes("signed")) {
        findings.push({
          findingType: "missing_evidence",
          severity: "medium",
          message: "signature not found",
          evidenceRefs,
        });
      }
    }

    // Confidence: mean of hit scores, clamped; zero when no evidence.
    const confidence =
      hits.length === 0
        ? 0
        : clamp01(hits.reduce((acc, h) => acc + h.score, 0) / hits.length);

    const hasCritical = findings.some((f) => f.severity === "critical");
    const recommendedDisposition: EvidenceSummaryOutput["recommendedDisposition"] = hasCritical
      ? "needs_human_review"
      : findings.length > 0
        ? "request_more_info"
        : "validated";

    const provider = getModelProvider();
    const completion = await provider.complete({
      prompt: [
        `Summarize the validation of "${subject.title ?? validationCaseId}".`,
        `Findings: ${findings.length === 0 ? "none" : findings.map((f) => `${f.findingType} (${f.severity})`).join(", ")}.`,
        "Evidence excerpts:",
        ...hits.map((h, i) => `(${i + 1}) [${h.objectType}] ${h.excerpt}`),
      ].join("\n"),
    });
    const summary =
      completion.text.trim() ||
      `Validation assessed for ${subject.title ?? validationCaseId}: ${recommendedDisposition}.`;

    const output: EvidenceSummaryOutput = {
      summary,
      confidence,
      findings,
      recommendedDisposition,
    };
    const validated = validateOutput(
      evidenceSummaryOutputSchema,
      output,
      evidenceSummary.key,
    );
    return { output: validated, citations: hits };
  },
};

registerFunction(evidenceSummary);

export {
  evidenceSummary,
  evidenceSummaryOutputSchema,
  findingSchema,
  findingTypeSchema,
  dispositionSchema,
};
