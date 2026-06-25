// Observability trace store (§43). Records cost / latency / tokens / retrieval
// method for every model interaction, scoped to function/agent/action runs.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import type { ActorContext } from "@/types/platform";
import type { ModelTrace } from "@/types/aiops";
import type { CompletionResponse } from "../models/model-provider";

export function recordTrace(
  ctx: ActorContext,
  scope: ModelTrace["scope"],
  scopeId: string,
  completion: CompletionResponse,
  retrievalMethod?: ModelTrace["retrievalMethod"],
): ModelTrace {
  return db.modelTraces.insert({
    id: id("trace"),
    tenantId: ctx.tenantId,
    scope,
    scopeId,
    provider: completion.provider,
    modelKey: completion.modelKey,
    promptTokens: completion.promptTokens,
    completionTokens: completion.completionTokens,
    latencyMs: completion.latencyMs,
    costUsd: completion.costUsd,
    retrievalMethod: retrievalMethod ?? null,
    createdAt: now(),
  });
}

export interface ObservabilitySummary {
  totalCostUsd: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  avgLatencyMs: number;
  traceCount: number;
}

export function summarize(ctx: ActorContext): ObservabilitySummary {
  const traces = db.modelTraces.list(ctx.tenantId);
  const traceCount = traces.length;
  const totalLatency = traces.reduce((s, t) => s + t.latencyMs, 0);
  return {
    totalCostUsd: traces.reduce((s, t) => s + t.costUsd, 0),
    totalPromptTokens: traces.reduce((s, t) => s + t.promptTokens, 0),
    totalCompletionTokens: traces.reduce((s, t) => s + t.completionTokens, 0),
    avgLatencyMs: traceCount ? totalLatency / traceCount : 0,
    traceCount,
  };
}
