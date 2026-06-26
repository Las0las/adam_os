// Phase 7 — eval suite bootstrap. Seeds the default per-domain eval suites and a
// sample case each so the evals surface has live data. Idempotent (dedupe by key).

import { createEvalSuite } from "./eval-run-repository";
import { createEvalCase } from "./eval-case-repository";
import { db } from "@/lib/lawrence-core/db";
import type { ActorContext } from "@/types/platform";
import type { EvalSuiteType } from "./eval-production-types";

interface SeedSuite {
  key: string;
  name: string;
  suiteType: EvalSuiteType;
  targetComponentKey: string;
  baseline: number;
  input: Record<string, unknown>;
  expected: Record<string, unknown>;
}

const SUITES: SeedSuite[] = [
  {
    key: "support_answer_retrieval_eval",
    name: "Support answer retrieval",
    suiteType: "retrieval",
    targetComponentKey: "answer_with_citations",
    baseline: 0.3,
    input: { query: "VPN setup instructions", methods: ["rank_fusion"] },
    expected: { expectedObjectRefs: [] },
  },
  {
    key: "executive_risk_response_eval",
    name: "Executive risk response",
    suiteType: "response",
    targetComponentKey: "answer_with_citations",
    baseline: 0.3,
    input: { functionKey: "answer_with_citations", question: "What are the account risks?" },
    expected: { requiredFacts: ["risk"], forbiddenClaims: ["guaranteed"] },
  },
];

export async function installEvalSuites(ctx: ActorContext): Promise<void> {
  for (const s of SUITES) {
    const existing = await db.evalSuites.find(ctx.tenantId, (x) => x.key === s.key);
    if (existing) continue;
    const suite = await createEvalSuite({
      tenantId: ctx.tenantId,
      key: s.key,
      name: s.name,
      suiteType: s.suiteType,
      targetComponentType: "function",
      targetComponentKey: s.targetComponentKey,
      baselineConfig: { averageScore: s.baseline },
    });
    await createEvalCase({
      tenantId: ctx.tenantId,
      suiteType: s.suiteType,
      suiteKey: suite.key,
      input: s.input,
      expected: s.expected,
    });
  }
}
