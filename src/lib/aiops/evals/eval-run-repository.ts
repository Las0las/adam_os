// Phase 7 — eval suite + run repository. Tenant-scoped persistence for eval
// suites and runs (runs reuse the existing EvalRun collection, extended with
// Phase 7 fields).

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import type { EvalCaseResult, EvalRun } from "@/types/aiops";
import type { EvalSuite, EvalSuiteType } from "./eval-production-types";

// ── Suites ───────────────────────────────────────────────────────────────────

export async function createEvalSuite(input: {
  tenantId: string;
  key: string;
  name: string;
  suiteType: EvalSuiteType;
  targetComponentType?: string | null;
  targetComponentKey?: string | null;
  baselineConfig?: Record<string, unknown>;
}): Promise<EvalSuite> {
  const existing = await db.evalSuites.find(input.tenantId, (s) => s.key === input.key);
  if (existing) return existing;
  return await db.evalSuites.insert({
    id: id("esuite"),
    tenantId: input.tenantId,
    key: input.key,
    name: input.name,
    suiteType: input.suiteType,
    status: "active",
    targetComponentType: input.targetComponentType ?? null,
    targetComponentKey: input.targetComponentKey ?? null,
    baselineConfig: input.baselineConfig ?? {},
    createdAt: now(),
  });
}

export async function getEvalSuite(tenantId: string, suiteId: string): Promise<EvalSuite | undefined> {
  return await db.evalSuites.get(tenantId, suiteId);
}

export async function listEvalSuites(tenantId: string): Promise<EvalSuite[]> {
  return (await db.evalSuites.list(tenantId)).sort((a, b) => a.key.localeCompare(b.key));
}

/** Latest active suite targeting a component (for release eval gates). */
export async function getActiveSuiteForComponent(
  tenantId: string,
  componentType: string,
  componentKey: string,
): Promise<EvalSuite | undefined> {
  return await db.evalSuites.find(
    tenantId,
    (s) =>
      s.status === "active" &&
      s.targetComponentType === componentType &&
      s.targetComponentKey === componentKey,
  );
}

// ── Runs ─────────────────────────────────────────────────────────────────────

export async function createEvalRun(input: {
  tenantId: string;
  suiteType: EvalRun["suiteType"];
  evalSuiteId?: string | null;
  targetComponentType?: string | null;
  targetComponentKey?: string | null;
  results: EvalCaseResult[];
  score: number;
  config?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
  passed?: boolean | null;
  regressionDetected?: boolean;
  createdBy?: string | null;
}): Promise<EvalRun> {
  return await db.evalRuns.insert({
    id: id("evalrun"),
    tenantId: input.tenantId,
    suiteType: input.suiteType,
    results: input.results,
    score: input.score,
    createdAt: now(),
    evalSuiteId: input.evalSuiteId ?? null,
    targetComponentType: input.targetComponentType ?? null,
    targetComponentKey: input.targetComponentKey ?? null,
    config: input.config ?? {},
    metrics: input.metrics ?? {},
    passed: input.passed ?? null,
    regressionDetected: input.regressionDetected ?? false,
    createdBy: input.createdBy ?? null,
  });
}

export async function getEvalRun(tenantId: string, runId: string): Promise<EvalRun | undefined> {
  return await db.evalRuns.get(tenantId, runId);
}

export async function listEvalRuns(
  tenantId: string,
  filters: { suiteId?: string; suiteType?: string } = {},
): Promise<EvalRun[]> {
  return (
    await db.evalRuns.list(tenantId, (r) => {
      if (filters.suiteId && r.evalSuiteId !== filters.suiteId) return false;
      if (filters.suiteType && r.suiteType !== filters.suiteType) return false;
      return true;
    })
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Latest run for a suite (used by release eval gates). */
export async function getLatestRunForSuite(
  tenantId: string,
  suiteId: string,
): Promise<EvalRun | undefined> {
  return (await listEvalRuns(tenantId, { suiteId }))[0];
}
