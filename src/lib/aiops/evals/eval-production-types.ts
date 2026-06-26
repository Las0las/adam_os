// Phase 7 — productionized eval contracts. Suites target a runtime component,
// carry a baseline for regression detection, and produce per-case results plus a
// run summary. Tenant-scoped rows (id/tenantId) back the Collection contract.

export type EvalSuiteType =
  | "retrieval"
  | "extraction"
  | "classification"
  | "response"
  | "recommendation"
  | "action";

export type EvalSuiteStatus = "active" | "inactive";

export interface EvalSuite {
  id: string;
  tenantId: string;
  key: string;
  name: string;
  suiteType: EvalSuiteType;
  status: EvalSuiteStatus;
  targetComponentType?: string | null;
  targetComponentKey?: string | null;
  /** Baseline metrics for regression comparison (e.g. { averageScore: 0.8 }). */
  baselineConfig: Record<string, unknown>;
  createdAt: string;
}

export interface EvalMetricResult {
  key: string;
  score: number;
  passed?: boolean;
  details?: Record<string, unknown>;
}

/** Tenant-scoped per-case result row (eval_case_results). */
export interface EvalCaseResultRecord {
  id: string;
  tenantId: string;
  evalRunId: string;
  evalCaseId: string;
  status: "completed" | "failed" | "skipped";
  actual: Record<string, unknown>;
  expected: Record<string, unknown>;
  scores: Record<string, number>;
  errors: string[];
  trace: Record<string, unknown>;
  createdAt: string;
}

export interface EvalRunSummary {
  evalRunId: string;
  suiteType: EvalSuiteType;
  targetComponentType?: string | null;
  targetComponentKey?: string | null;
  caseCount: number;
  passCount: number;
  failCount: number;
  averageScore: number;
  regressionDetected: boolean;
  metrics: Record<string, unknown>;
}

export interface RetrievalEvalExpected {
  query: string;
  expectedObjectRefs: Array<{ objectType: string; objectId: string }>;
}

export interface ExtractionEvalExpected {
  fields: Record<string, unknown>;
}

export interface ResponseEvalExpected {
  requiredFacts?: string[];
  forbiddenClaims?: string[];
  expectedCitations?: Array<{ objectType: string; objectId: string }>;
}

export interface RecommendationEvalExpected {
  expectedActionKeys: string[];
  unacceptableActionKeys?: string[];
}
