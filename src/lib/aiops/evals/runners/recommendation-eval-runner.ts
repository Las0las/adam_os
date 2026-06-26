// Phase 7 — recommendation eval. Scores whether the recommended action matches
// an expected action and avoids unacceptable ones.

import { runFunction } from "../../functions/function-runner";
import type { ActorContext } from "@/types/platform";
import type { EvalCase } from "@/types/aiops";
import type { RecommendationEvalExpected } from "../eval-production-types";
import type { CaseOutcome } from "./eval-case-outcome";

export async function runRecommendationCase(
  ctx: ActorContext,
  evalCase: EvalCase,
): Promise<CaseOutcome> {
  const functionKey = String(evalCase.input.functionKey ?? "recommend_next_action");
  const expected = evalCase.expected as unknown as RecommendationEvalExpected;
  const expectedKeys = expected.expectedActionKeys ?? [];
  const unacceptable = expected.unacceptableActionKeys ?? [];

  const run = await runFunction(ctx, functionKey, evalCase.input);
  const output = (run.output ?? {}) as Record<string, unknown>;
  const predicted = String(
    output.recommendedActionKey ?? output.actionKey ?? output.nextAction ?? output.recommendation ?? "",
  );

  const matched = expectedKeys.includes(predicted) ? 1 : 0;
  const avoided = unacceptable.includes(predicted) ? 0 : 1;
  const hasRationale = typeof output.rationale === "string" && (output.rationale as string).length > 0 ? 1 : 0;

  const scores = { actionMatch: matched, avoidedUnacceptable: avoided, rationalePresent: hasRationale };

  return {
    actual: { predicted },
    expected: { expectedActionKeys: expectedKeys, unacceptableActionKeys: unacceptable },
    scores,
    primaryScore: matched && avoided ? 1 : 0,
    passed: matched === 1 && avoided === 1,
    errors: [],
    trace: { functionKey, status: run.status },
  };
}
