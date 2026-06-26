// Phase 7 — classification eval. Runs the classifier and scores accuracy plus
// per-case false-positive/false-negative indicators against the expected label.

import { runFunction } from "../../functions/function-runner";
import type { ActorContext } from "@/types/platform";
import type { EvalCase } from "@/types/aiops";
import type { CaseOutcome } from "./eval-case-outcome";

export async function runClassificationCase(
  ctx: ActorContext,
  evalCase: EvalCase,
): Promise<CaseOutcome> {
  const functionKey = String(evalCase.input.functionKey ?? "classify_document");
  const expectedLabel = String(evalCase.expected.label ?? evalCase.expected.category ?? "");

  const run = await runFunction(ctx, functionKey, evalCase.input);
  const output = (run.output ?? {}) as Record<string, unknown>;
  const predicted = String(output.label ?? output.category ?? output.classification ?? "");
  const confidence = typeof output.confidence === "number" ? output.confidence : null;

  const correct = predicted === expectedLabel;
  const scores = {
    accuracy: correct ? 1 : 0,
    falsePositive: !correct && predicted !== "" ? 1 : 0,
    falseNegative: !correct && predicted === "" ? 1 : 0,
    confidenceCalibration: confidence != null ? (correct ? confidence : 1 - confidence) : 0,
  };

  return {
    actual: { predicted, confidence },
    expected: { label: expectedLabel },
    scores,
    primaryScore: scores.accuracy,
    passed: correct,
    errors: run.error ? [run.error] : [],
    trace: { functionKey, status: run.status },
  };
}
