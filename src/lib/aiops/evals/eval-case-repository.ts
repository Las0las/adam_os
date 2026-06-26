// Phase 7 — eval case repository. Cases are bound to a suite via
// metadata.suiteKey; absent that, they fall back to suite-type matching.

import { db } from "@/lib/lawrence-core/db";
import { id } from "@/lib/lawrence-core/utils/ids";
import type { EvalCase } from "@/types/aiops";
import type { EvalSuite } from "./eval-production-types";

export async function createEvalCase(input: {
  tenantId: string;
  suiteType: EvalCase["suiteType"];
  suiteKey?: string;
  input: Record<string, unknown>;
  expected: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): Promise<EvalCase> {
  return await db.evalCases.insert({
    id: id("evalcase"),
    tenantId: input.tenantId,
    suiteType: input.suiteType,
    input: input.input,
    expected: input.expected,
    metadata: { ...(input.metadata ?? {}), suiteKey: input.suiteKey ?? null },
  });
}

export async function listCasesForSuite(
  tenantId: string,
  suite: EvalSuite,
): Promise<EvalCase[]> {
  const bound = await db.evalCases.list(
    tenantId,
    (c) => (c.metadata?.suiteKey as string | undefined) === suite.key,
  );
  if (bound.length > 0) return bound;
  // Fallback: any case of the same suite type.
  return await db.evalCases.list(tenantId, (c) => c.suiteType === suite.suiteType);
}
