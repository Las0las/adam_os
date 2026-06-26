// generate-draft-response (§26). Drafts a response grounded on retrieved
// evidence — a drafting-class function used by support/claims/exec packs.

import { getModelProvider } from "../../models/model-provider";
import { runModelCompletion } from "../../execution/inference-pipeline";
import { retrieve } from "../../retrieval/retrieval-service";
import { recordTrace } from "../../observability/trace-service";
import { renderTemplate } from "../../prompts/prompt-service";
import { id } from "@/lib/lawrence-core/utils/ids";
import type { LawrenceFunction, FunctionExecutionResult } from "../function-types";
import type { ActorContext } from "@/types/platform";
import type { RetrievalMethod } from "@/types/dataops";

interface DraftInput {
  prompt: string;
  tone?: string;
  objectTypes?: string[];
  subjectObjectId?: string;
  methods?: RetrievalMethod[];
}
interface DraftOutput {
  draft: string;
  citationCount: number;
}

const TEMPLATE = `Draft a {{tone}} response to the request below, grounded only on the evidence.
Request: {{prompt}}

Evidence:
{{evidence}}`;

export const generateDraftResponse: LawrenceFunction<DraftInput, DraftOutput> = {
  key: "generate_draft_response",
  name: "Generate draft response",
  description: "Draft an evidence-grounded response with citations.",
  klass: "draft",
  outputSchema: {
    type: "object",
    properties: { draft: { type: "string" }, citationCount: { type: "number" } },
    required: ["draft", "citationCount"],
  },
  async run(ctx: ActorContext, input: DraftInput): Promise<FunctionExecutionResult<DraftOutput>> {
    const methods = input.methods ?? ["rank_fusion"];
    const retrieval = await retrieve(ctx, {
      tenantId: ctx.tenantId,
      query: input.prompt,
      objectTypes: input.objectTypes,
      subjectObjectId: input.subjectObjectId ?? null,
      methods,
      limit: 6,
    });
    const evidence = retrieval.hits.map((h) => `[${h.chunkId}] ${h.excerpt}`).join("\n");
    const prompt = renderTemplate(TEMPLATE, {
      tone: input.tone ?? "professional",
      prompt: input.prompt,
      evidence,
    });
    const completion = await runModelCompletion({ provider: getModelProvider(), request: { prompt }, workloadType: "draft" });
    const traceId = id("trace");
    await recordTrace(ctx, "function_run", traceId, completion, methods[0]);
    return {
      output: { draft: completion.text, citationCount: retrieval.hits.length },
      citations: retrieval.hits,
      trace: { traceId },
    };
  },
};
