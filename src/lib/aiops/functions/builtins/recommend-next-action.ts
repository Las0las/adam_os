// recommend-next-action (§26). Reasoning-class function that proposes the next
// action for an object, returning a typed recommendation (not an execution).

import { db } from "@/lib/lawrence-core/db";
import { getModelProvider } from "../../models/model-provider";
import { runModelCompletion } from "../../execution/inference-pipeline";
import { recordTrace } from "../../observability/trace-service";
import { id } from "@/lib/lawrence-core/utils/ids";
import type { LawrenceFunction, FunctionExecutionResult } from "../function-types";
import type { ActorContext } from "@/types/platform";

interface RecommendInput {
  objectType: string;
  objectId: string;
  candidateActions: string[];
}
interface RecommendOutput {
  recommendedAction: string;
  rationale: string;
  confidence: number;
}

export const recommendNextAction: LawrenceFunction<RecommendInput, RecommendOutput> = {
  key: "recommend_next_action",
  name: "Recommend next action",
  description: "Propose the next action for an object from a candidate set, with a rationale.",
  klass: "reason",
  outputSchema: {
    type: "object",
    properties: {
      recommendedAction: { type: "string" },
      rationale: { type: "string" },
      confidence: { type: "number" },
    },
    required: ["recommendedAction", "rationale", "confidence"],
  },
  async run(ctx: ActorContext, input: RecommendInput): Promise<FunctionExecutionResult<RecommendOutput>> {
    const obj = await db.ontologyObjects.get(ctx.tenantId, input.objectId);
    const status = obj?.status ?? "unknown";
    // Deterministic policy: pick the first candidate action whose name is not
    // the current status; a real provider reasons over evidence here.
    const recommended =
      input.candidateActions.find((a) => a !== status) ?? input.candidateActions[0] ?? "no_action";
    const completion = await runModelCompletion({
      provider: getModelProvider(),
      request: {
        prompt: `Object ${input.objectType} status=${status}. Choose from [${input.candidateActions.join(", ")}].`,
        outputSchema: recommendNextAction.outputSchema,
      },
      workloadType: "reason",
    });
    const traceId = id("trace");
    await recordTrace(ctx, "function_run", traceId, completion);
    return {
      output: {
        recommendedAction: recommended,
        rationale: `Current status is ${status}; ${recommended} advances the object.`,
        confidence: 0.6,
      },
      trace: { traceId },
    };
  },
};
