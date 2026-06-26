// Phase 7 — eval case result repository. Per-case result rows for a run.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import type { EvalCaseResultRecord } from "./eval-production-types";

export async function writeCaseResult(input: {
  tenantId: string;
  evalRunId: string;
  evalCaseId: string;
  status?: EvalCaseResultRecord["status"];
  actual?: Record<string, unknown>;
  expected?: Record<string, unknown>;
  scores?: Record<string, number>;
  errors?: string[];
  trace?: Record<string, unknown>;
}): Promise<EvalCaseResultRecord> {
  return await db.evalCaseResults.insert({
    id: id("ecres"),
    tenantId: input.tenantId,
    evalRunId: input.evalRunId,
    evalCaseId: input.evalCaseId,
    status: input.status ?? "completed",
    actual: input.actual ?? {},
    expected: input.expected ?? {},
    scores: input.scores ?? {},
    errors: input.errors ?? [],
    trace: input.trace ?? {},
    createdAt: now(),
  });
}

export async function listCaseResults(
  tenantId: string,
  evalRunId: string,
): Promise<EvalCaseResultRecord[]> {
  return await db.evalCaseResults.list(tenantId, (r) => r.evalRunId === evalRunId);
}
