// Phase 7 — response eval. Deterministic groundedness checks first: required
// facts present, forbidden claims absent, expected citations included. An
// optional LLM judge could augment but is never the sole basis.

import { runFunction } from "../../functions/function-runner";
import { containsAll, containsAny, citationCoverage, mean } from "../eval-metrics";
import type { ActorContext } from "@/types/platform";
import type { EvalCase } from "@/types/aiops";
import type { ResponseEvalExpected } from "../eval-production-types";
import type { CaseOutcome } from "./eval-case-outcome";

export async function runResponseCase(ctx: ActorContext, evalCase: EvalCase): Promise<CaseOutcome> {
  const functionKey = String(evalCase.input.functionKey ?? "answer_with_citations");
  const expected = evalCase.expected as ResponseEvalExpected;
  const requiredFacts = expected.requiredFacts ?? [];
  const forbiddenClaims = expected.forbiddenClaims ?? [];
  const expectedCitations = expected.expectedCitations ?? [];

  const run = await runFunction(ctx, functionKey, evalCase.input);
  const output = (run.output ?? {}) as Record<string, unknown>;
  const text = String(output.answer ?? output.draft ?? output.response ?? "");
  const citationIds = (run.citations ?? []).map((c) => c.objectId);

  const facts = containsAll(text, requiredFacts);
  const violations = containsAny(text, forbiddenClaims);
  const factCoverage = requiredFacts.length ? facts.present.length / requiredFacts.length : 1;
  const policyAdherence = forbiddenClaims.length ? 1 - violations.length / forbiddenClaims.length : 1;
  const citCoverage = citationCoverage(
    citationIds,
    expectedCitations.map((c) => c.objectId),
  );
  const groundedness = citationIds.length > 0 ? 1 : 0;

  const scores = {
    groundedness,
    citationCorrectness: citCoverage,
    policyAdherence,
    completeness: factCoverage,
  };
  const primaryScore = mean([factCoverage, policyAdherence, citCoverage]);

  return {
    actual: { text: text.slice(0, 500), citationIds },
    expected: { requiredFacts, forbiddenClaims, expectedCitations },
    scores,
    primaryScore,
    passed: facts.missing.length === 0 && violations.length === 0 && (expectedCitations.length === 0 || citCoverage > 0),
    errors: violations.length ? [`forbidden claims present: ${violations.join(", ")}`] : [],
    trace: { functionKey, missingFacts: facts.missing, violations },
  };
}
