// Function runner (§26). Wraps a LawrenceFunction with a persisted FunctionRun,
// permission check, audit, and observability — the governed execution envelope.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import { resolveFunction } from "./function-registry";
import type { ActorContext } from "@/types/platform";
import type { FunctionRun } from "@/types/aiops";

export async function runFunction(
  ctx: ActorContext,
  functionKey: string,
  input: Record<string, unknown>,
): Promise<FunctionRun> {
  requirePermission(ctx, "aiops.function_admin");
  const fn = resolveFunction(functionKey);
  if (!fn) throw new Error(`Unknown function: ${functionKey}`);

  const run = await db.functionRuns.insert({
    id: id("frun"),
    tenantId: ctx.tenantId,
    functionId: fn.key,
    input,
    output: null,
    citations: [],
    status: "running",
    traceId: null,
    error: null,
    createdAt: now(),
  });

  try {
    const result = await fn.run(ctx, input);
    const completed = await db.functionRuns.update(run.id, {
      status: "completed",
      output: result.output as Record<string, unknown>,
      citations: result.citations ?? [],
      traceId: (result.trace?.traceId as string | undefined) ?? null,
    });
    await emitAudit(ctx, "aiops.function.run", { type: "function_run", id: run.id }, { functionKey });
    return completed;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const failed = await db.functionRuns.update(run.id, { status: "failed", error: message });
    await emitAudit(ctx, "aiops.function.run.failed", { type: "function_run", id: run.id }, { functionKey, error: message });
    return failed;
  }
}
