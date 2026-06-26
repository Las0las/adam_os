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
  await installCandidateExtractionEval(ctx);
}

// Labeled cases for the paste-a-profile extraction (synthetic data only). Each
// runs `extract_candidate_fields` and scores the fields against `expected`.
const CANDIDATE_EXTRACTION_CASES: Array<{ text: string; fields: Record<string, unknown> }> = [
  {
    text: "Dana Diaz — Staff Engineer at Acme (Remote). Email dana@example.test, phone +1-555-0100.",
    fields: {
      fullName: "Dana Diaz",
      email: "dana@example.test",
      phone: "+1-555-0100",
      location: "Remote",
      currentTitle: "Staff Engineer",
      currentCompany: "Acme",
    },
  },
  {
    text: "Sam Roe\nProduct Manager, Globex — New York, NY\nsam.roe@example.test",
    fields: {
      fullName: "Sam Roe",
      email: "sam.roe@example.test",
      location: "New York, NY",
      currentTitle: "Product Manager",
      currentCompany: "Globex",
    },
  },
  {
    text: "Mia Cole, BS Computer Science, State University. Backend engineer. linkedin.com/in/miacole",
    fields: {
      fullName: "Mia Cole",
      educationDegree: "BS Computer Science",
      educationInstitution: "State University",
      profileUrl: "linkedin.com/in/miacole",
    },
  },
];

/** Seed the recruiting candidate-extraction eval suite + its labeled cases. The
 *  baseline reflects a real model; the deterministic mock scores ~0, which the
 *  eval surfaces (extraction needs a configured provider to be accurate). */
async function installCandidateExtractionEval(ctx: ActorContext): Promise<void> {
  const key = "recruiting_candidate_extraction";
  if (await db.evalSuites.find(ctx.tenantId, (x) => x.key === key)) return;
  const suite = await createEvalSuite({
    tenantId: ctx.tenantId,
    key,
    name: "Recruiting candidate extraction",
    suiteType: "extraction",
    targetComponentType: "function",
    targetComponentKey: "extract_candidate_fields",
    baselineConfig: { averageScore: 0.7 },
  });
  for (const c of CANDIDATE_EXTRACTION_CASES) {
    await createEvalCase({
      tenantId: ctx.tenantId,
      suiteType: "extraction",
      suiteKey: suite.key,
      input: { functionKey: "extract_candidate_fields", text: c.text },
      expected: { fields: c.fields },
    });
  }
}
