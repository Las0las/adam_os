// answer-with-citations (§26). Retrieves evidence, calls the model grounded on
// the retrieved excerpts, and returns the answer WITH the citations used — the
// canonical evidence-backed reasoning function.

import { getModelProvider } from "../../models/model-provider";
import { retrieve } from "../../retrieval/retrieval-service";
import { recordTrace } from "../../observability/trace-service";
import { renderTemplate } from "../../prompts/prompt-service";
import { id } from "@/lib/lawrence-core/utils/ids";
import type { LawrenceFunction, FunctionExecutionResult } from "../function-types";
import type { ActorContext } from "@/types/platform";
import type { RetrievalMethod } from "@/types/dataops";

interface AnswerInput {
  question: string;
  objectTypes?: string[];
  subjectObjectId?: string;
  methods?: RetrievalMethod[];
}

interface AnswerOutput {
  answer: string;
  citationCount: number;
}

const TEMPLATE = `You are LAWRENCE, answering strictly from the evidence below.
Question: {{question}}

Evidence:
{{evidence}}

Answer using only the evidence. Cite chunk ids inline like [chunkId].`;

export const answerWithCitations: LawrenceFunction<AnswerInput, AnswerOutput> = {
  key: "answer_with_citations",
  name: "Answer with citations",
  description: "Retrieve evidence and answer grounded on it, returning the citations used.",
  klass: "reason",
  outputSchema: {
    type: "object",
    properties: { answer: { type: "string" }, citationCount: { type: "number" } },
    required: ["answer", "citationCount"],
  },
  async run(ctx: ActorContext, input: AnswerInput): Promise<FunctionExecutionResult<AnswerOutput>> {
    const methods = input.methods ?? ["rank_fusion"];
    const retrieval = await retrieve(ctx, {
      tenantId: ctx.tenantId,
      query: input.question,
      objectTypes: input.objectTypes,
      subjectObjectId: input.subjectObjectId ?? null,
      methods,
      limit: 6,
    });

    const evidence = retrieval.hits
      .map((h) => `[${h.chunkId}] ${h.excerpt}`)
      .join("\n");
    const prompt = renderTemplate(TEMPLATE, { question: input.question, evidence });

    const completion = await getModelProvider().complete({ prompt });
    const traceId = id("trace");
    await recordTrace(ctx, "function_run", traceId, completion, methods[0]);

    return {
      output: { answer: completion.text, citationCount: retrieval.hits.length },
      citations: retrieval.hits,
      trace: { traceId, retrieval: retrieval.trace },
    };
  },
};
