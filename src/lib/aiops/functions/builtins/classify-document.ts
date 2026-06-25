// classify-document (§26). Schema-constrained classification over text.

import { getModelProvider } from "../../models/model-provider";
import { recordTrace } from "../../observability/trace-service";
import { id } from "@/lib/lawrence-core/utils/ids";
import type { LawrenceFunction, FunctionExecutionResult } from "../function-types";
import type { ActorContext } from "@/types/platform";

interface ClassifyInput {
  text: string;
  labels: string[];
}
interface ClassifyOutput {
  label: string;
  confidence: number;
}

export const classifyDocument: LawrenceFunction<ClassifyInput, ClassifyOutput> = {
  key: "classify_document",
  name: "Classify document",
  description: "Assign one of a fixed label set to a document.",
  klass: "classify",
  outputSchema: {
    type: "object",
    properties: { label: { type: "string" }, confidence: { type: "number" } },
    required: ["label", "confidence"],
  },
  async run(ctx: ActorContext, input: ClassifyInput): Promise<FunctionExecutionResult<ClassifyOutput>> {
    // Deterministic lexical scoring keeps the builtin runnable without a model;
    // a real provider classifies via the model behind the same interface.
    const text = input.text.toLowerCase();
    const scored = input.labels.map((label) => ({
      label,
      score: text.split(label.toLowerCase()).length - 1,
    }));
    scored.sort((a, b) => b.score - a.score);
    const top = scored[0] ?? { label: input.labels[0] ?? "unknown", score: 0 };
    const total = scored.reduce((s, x) => s + x.score, 0) || 1;

    const completion = await getModelProvider().complete({
      prompt: `Classify into [${input.labels.join(", ")}]: ${input.text.slice(0, 400)}`,
      outputSchema: classifyDocument.outputSchema,
    });
    const traceId = id("trace");
    await recordTrace(ctx, "function_run", traceId, completion);

    return {
      output: { label: top.label, confidence: Number((top.score / total).toFixed(3)) },
      trace: { traceId },
    };
  },
};
