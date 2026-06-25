// summarize-object (§26). Summarizes an ontology object's evidence chunks.

import { db } from "@/lib/lawrence-core/db";
import { getModelProvider } from "../../models/model-provider";
import { recordTrace } from "../../observability/trace-service";
import { id } from "@/lib/lawrence-core/utils/ids";
import type { LawrenceFunction, FunctionExecutionResult } from "../function-types";
import type { ActorContext } from "@/types/platform";

interface SummarizeInput {
  objectType: string;
  objectId: string;
}
interface SummarizeOutput {
  summary: string;
}

export const summarizeObject: LawrenceFunction<SummarizeInput, SummarizeOutput> = {
  key: "summarize_object",
  name: "Summarize object",
  description: "Summarize an ontology object from its linked evidence chunks.",
  klass: "summarize",
  outputSchema: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] },
  async run(ctx: ActorContext, input: SummarizeInput): Promise<FunctionExecutionResult<SummarizeOutput>> {
    const chunks = await db.evidenceChunks.list(
      ctx.tenantId,
      (c) => c.sourceObjectId === input.objectId,
    );
    const body = chunks.map((c) => c.text).join("\n\n").slice(0, 4000);
    const completion = await getModelProvider().complete({
      prompt: `Summarize the following ${input.objectType} concisely:\n${body}`,
    });
    const traceId = id("trace");
    await recordTrace(ctx, "function_run", traceId, completion);
    return { output: { summary: completion.text }, trace: { traceId } };
  },
};
