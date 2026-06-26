// Phase 4 SUPPORT — ticket RAG function. Answers a support ticket grounded on
// KnowledgeDocument evidence, returns citations, and self-flags low-confidence /
// no-evidence answers for human review. Fails closed when the ticket is missing
// or the knowledge base yields no evidence. Self-registers on import.

import { z } from "zod";
import { registerFunction } from "@/lib/aiops/functions/function-registry";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { retrieve } from "@/lib/aiops/retrieval/retrieval-service";
import { getModelProvider } from "@/lib/aiops/models/model-provider";
import { runModelCompletion } from "@/lib/aiops/execution/inference-pipeline";
import type {
  LawrenceFunction,
  FunctionExecutionResult,
} from "@/lib/aiops/functions/function-types";
import type { RetrievalHit } from "@/types/dataops";

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Citation projected from a retrieval hit (the citeable, explainable unit). */
const citationSchema = z.object({
  objectType: z.string(),
  objectId: z.string(),
  excerpt: z.string(),
  score: z.number(),
});

const outputSchema = z.object({
  draftResponse: z.string(),
  confidence: z.number(),
  citations: z.array(citationSchema),
  missingEvidence: z.boolean(),
  needsReview: z.boolean(),
});

export type AnswerWithCitationsOutput = z.infer<typeof outputSchema>;

const answerWithCitations: LawrenceFunction<
  { ticketId?: unknown; query?: unknown },
  AnswerWithCitationsOutput
> = {
  key: "support.answer_with_citations",
  name: "Answer support ticket with citations",
  description:
    "Answer a support ticket grounded on knowledge-base evidence, returning citations and a review flag.",
  klass: "draft",
  outputSchema: {
    type: "object",
    properties: {
      draftResponse: { type: "string" },
      confidence: { type: "number" },
      citations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            objectType: { type: "string" },
            objectId: { type: "string" },
            excerpt: { type: "string" },
            score: { type: "number" },
          },
          required: ["objectType", "objectId", "excerpt", "score"],
        },
      },
      missingEvidence: { type: "boolean" },
      needsReview: { type: "boolean" },
    },
    required: ["draftResponse", "confidence", "citations", "missingEvidence", "needsReview"],
  },
  async run(ctx, input): Promise<FunctionExecutionResult<AnswerWithCitationsOutput>> {
    const ticketId = String(input.ticketId ?? "");
    const query = input.query == null ? undefined : String(input.query);

    // Fail closed if the ticket does not exist.
    const tickets = await listObjects(ctx, "SupportTicket");
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket) {
      throw new Error(`support.answer_with_citations: SupportTicket not found: ${ticketId}`);
    }

    const effectiveQuery = query ?? ticket.title ?? "";
    const { hits } = await retrieve(ctx, {
      tenantId: ctx.tenantId,
      query: effectiveQuery,
      objectTypes: ["KnowledgeDocument"],
      methods: ["rank_fusion"],
      limit: 6,
    });

    // No knowledge-base evidence → fail closed into a review-flagged answer.
    if (hits.length === 0) {
      const output: AnswerWithCitationsOutput = {
        draftResponse: "Insufficient knowledge-base evidence to answer.",
        confidence: 0,
        citations: [],
        missingEvidence: true,
        needsReview: true,
      };
      const validated = validate(output);
      return { output: validated, citations: [] };
    }

    // Ground the model strictly on the retrieved hits.
    const grounding = hits
      .map((h, i) => `[${i + 1}] (${h.objectType} ${h.objectId}) ${h.excerpt}`)
      .join("\n");
    const provider = getModelProvider();
    const completion = await runModelCompletion({
      provider,
      request: {
        prompt: [
          "You are a support agent. Answer the ticket using ONLY the evidence below.",
          "Do not invent facts. Cite the evidence you use.",
          "",
          `Ticket: ${ticket.title ?? ticketId}`,
          `Question: ${effectiveQuery}`,
          "",
          "Evidence:",
          grounding,
        ].join("\n"),
      },
      workloadType: "support.answer_ticket",
    });

    const scoreSum = hits.reduce((sum, h) => sum + h.score, 0);
    const confidence = clamp(scoreSum / hits.length, 0, 1);
    const needsReview = confidence < 0.5;

    const output: AnswerWithCitationsOutput = {
      draftResponse: completion.text,
      confidence,
      citations: hits.map((h) => ({
        objectType: h.objectType,
        objectId: h.objectId,
        excerpt: h.excerpt,
        score: h.score,
      })),
      missingEvidence: false,
      needsReview,
    };
    const validated = validate(output);
    return { output: validated, citations: hits as RetrievalHit[] };
  },
};

function validate(value: AnswerWithCitationsOutput): AnswerWithCitationsOutput {
  const parsed = outputSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      `support.answer_with_citations: output failed schema validation — ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

registerFunction(answerWithCitations);

export { answerWithCitations };
