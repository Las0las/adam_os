// Phase 4 RECRUITING — candidate-fit reasoning function. Grounds a fit summary
// on retrieved evidence, computes a deterministic match score, and fails closed
// when the candidate/job is missing. Self-registers on import.

import { z } from "zod";
import { registerFunction } from "@/lib/aiops/functions/function-registry";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { retrieve } from "@/lib/aiops/retrieval/retrieval-service";
import { getModelProvider } from "@/lib/aiops/models/model-provider";
import { validateOutput } from "@/lib/domains/domain-workflow-types";
import type { LawrenceFunction, FunctionExecutionResult } from "@/lib/aiops/functions/function-types";
import type { RetrievalHit } from "@/types/dataops";

const evidenceItemSchema = z.object({
  objectType: z.string(),
  objectId: z.string(),
  excerpt: z.string(),
  score: z.number(),
});

const candidateFitOutputSchema = z.object({
  summary: z.string(),
  matchScore: z.number(),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  riskFlags: z.array(z.string()),
  evidence: z.array(evidenceItemSchema),
  recommendedNextAction: z.enum(["shortlist", "request_screen", "needs_review"]),
});

export type CandidateFitOutput = z.infer<typeof candidateFitOutputSchema>;

interface CandidateFitInput {
  candidateId: string;
  jobId: string;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

const candidateFitSummary: LawrenceFunction<CandidateFitInput, CandidateFitOutput> = {
  key: "recruiting.candidate_fit_summary",
  name: "Candidate fit summary",
  description:
    "Reason over a candidate's evidence against a job and produce a grounded fit summary, score, and next action.",
  klass: "reason",
  outputSchema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      matchScore: { type: "number" },
      strengths: { type: "array", items: { type: "string" } },
      gaps: { type: "array", items: { type: "string" } },
      riskFlags: { type: "array", items: { type: "string" } },
      evidence: { type: "array", items: { type: "object" } },
      recommendedNextAction: { type: "string" },
    },
    required: ["summary", "matchScore", "recommendedNextAction"],
  },
  async run(ctx, input): Promise<FunctionExecutionResult<CandidateFitOutput>> {
    const candidateId = String(input.candidateId);
    const jobId = String(input.jobId);

    // Fail closed: both ends of the match must exist.
    const candidates = await listObjects(ctx, "Candidate");
    const candidate = candidates.find((c) => c.id === candidateId);
    if (!candidate) throw new Error("missing candidate");

    const jobs = await listObjects(ctx, "Job");
    const job = jobs.find((j) => j.id === jobId);
    if (!job) throw new Error("missing job");

    const query = `${candidate.title ?? "candidate"} ${job.title ?? "job"}`.trim();
    const { hits } = await retrieve(ctx, {
      tenantId: ctx.tenantId,
      query,
      objectTypes: ["Candidate", "Job"],
      subjectObjectId: candidateId,
      methods: ["rank_fusion"],
      limit: 6,
    });

    const evidence = hits.map((h: RetrievalHit) => ({
      objectType: h.objectType,
      objectId: h.objectId,
      excerpt: h.excerpt,
      score: h.score,
    }));

    if (hits.length === 0) {
      const output: CandidateFitOutput = {
        summary: "insufficient evidence",
        matchScore: 0,
        strengths: [],
        gaps: [],
        riskFlags: [],
        evidence: [],
        recommendedNextAction: "needs_review",
      };
      const validated = validateOutput(candidateFitOutputSchema, output, candidateFitSummary.key);
      return { output: validated, citations: hits };
    }

    // Deterministic match score: average of hit scores, clamped to 0..1.
    const sumScores = hits.reduce((acc, h) => acc + h.score, 0);
    const matchScore = clamp01(sumScores / hits.length);

    const provider = getModelProvider();
    const completion = await provider.complete({
      prompt: [
        `Assess how well candidate "${candidate.title ?? candidateId}" fits job "${job.title ?? jobId}".`,
        "Evidence excerpts:",
        ...hits.map((h, i) => `(${i + 1}) [${h.objectType}] ${h.excerpt}`),
      ].join("\n"),
    });
    const summary = completion.text.trim() || `Candidate fit assessed for ${job.title ?? jobId}.`;

    const recommendedNextAction: CandidateFitOutput["recommendedNextAction"] =
      matchScore >= 0.75 ? "shortlist" : hits.length ? "request_screen" : "needs_review";

    const output: CandidateFitOutput = {
      summary,
      matchScore,
      strengths: hits.map((h) => h.excerpt).slice(0, 3),
      gaps: [],
      riskFlags: [],
      evidence,
      recommendedNextAction,
    };
    const validated = validateOutput(candidateFitOutputSchema, output, candidateFitSummary.key);
    return { output: validated, citations: hits };
  },
};

registerFunction(candidateFitSummary);

export { candidateFitSummary, candidateFitOutputSchema };
