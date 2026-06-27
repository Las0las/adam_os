// extract-structured-fields (§26). Typed extraction against an output schema.

import { getModelProvider } from "../../models/model-provider";
import { runModelCompletion } from "../../execution/inference-pipeline";
import { recordTrace } from "../../observability/trace-service";
import { id } from "@/lib/lawrence-core/utils/ids";
import type { LawrenceFunction, FunctionExecutionResult } from "../function-types";
import type { ActorContext } from "@/types/platform";

interface ExtractInput {
  text: string;
  schema: Record<string, unknown>;
}
type ExtractOutput = Record<string, unknown>;

export const extractStructuredFields: LawrenceFunction<ExtractInput, ExtractOutput> = {
  key: "extract_structured_fields",
  name: "Extract structured fields",
  description: "Extract typed fields from unstructured text against a caller-supplied schema.",
  klass: "extract",
  outputSchema: { type: "object", properties: {} },
  async run(ctx: ActorContext, input: ExtractInput): Promise<FunctionExecutionResult<ExtractOutput>> {
    const completion = await runModelCompletion({
      provider: getModelProvider(),
      request: {
        prompt: `Extract fields as JSON from:\n${input.text.slice(0, 2000)}`,
        outputSchema: input.schema,
      },
      workloadType: "extract",
    });
    const traceId = id("trace");
    await recordTrace(ctx, "function_run", traceId, completion);
    return { output: completion.json ?? {}, trace: { traceId } };
  },
};
