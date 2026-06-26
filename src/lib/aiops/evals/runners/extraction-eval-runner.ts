// Phase 7 — extraction eval. Runs the extraction function and scores field-level
// exact/missing/hallucinated/type accuracy against the expected fields.

import { runFunction } from "../../functions/function-runner";
import { fieldAccuracy } from "../eval-metrics";
import type { ActorContext } from "@/types/platform";
import type { EvalCase } from "@/types/aiops";
import type { CaseOutcome } from "./eval-case-outcome";

export async function runExtractionCase(ctx: ActorContext, evalCase: EvalCase): Promise<CaseOutcome> {
  const functionKey = String(evalCase.input.functionKey ?? "extract_structured_fields");
  const expectedFields = (evalCase.expected.fields as Record<string, unknown> | undefined) ?? evalCase.expected;

  const run = await runFunction(ctx, functionKey, evalCase.input);
  const output = (run.output ?? {}) as Record<string, unknown>;
  // Extraction functions may nest under `fields`.
  const actual = (output.fields as Record<string, unknown> | undefined) ?? output;

  const acc = fieldAccuracy(actual, expectedFields);
  const scores = {
    exactMatchRate: acc.exactMatchRate,
    missingFieldRate: acc.missingFieldRate,
    hallucinatedFieldRate: acc.hallucinatedFieldRate,
    typeAccuracy: acc.typeAccuracy,
  };

  return {
    actual,
    expected: expectedFields,
    scores,
    primaryScore: acc.exactMatchRate,
    passed: acc.exactMatchRate === 1 && run.status === "completed",
    errors: run.error ? [run.error] : [],
    trace: { functionKey, status: run.status },
  };
}
