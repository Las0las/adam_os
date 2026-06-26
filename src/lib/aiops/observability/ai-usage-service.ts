// Phase 7 — AI usage service. Records token/cost/latency per model call and
// summarizes cost + latency over a window. Tenant-scoped.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import type { ActorContext } from "@/types/platform";
import type { AiUsageEvent, CostMetrics, LatencyMetrics } from "./observability-types";

export interface RecordAiUsageInput {
  runType: string;
  runId: string;
  provider?: string | null;
  modelKey?: string | null;
  purpose?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  estimatedCost?: number | null;
  latencyMs?: number | null;
  status: string;
  errorMessage?: string | null;
}

export async function recordAiUsage(
  ctx: ActorContext,
  input: RecordAiUsageInput,
): Promise<AiUsageEvent> {
  const totalTokens =
    input.promptTokens != null || input.completionTokens != null
      ? (input.promptTokens ?? 0) + (input.completionTokens ?? 0)
      : null;
  return await db.aiUsageEvents.insert({
    id: id("usage"),
    tenantId: ctx.tenantId,
    runType: input.runType,
    runId: input.runId,
    provider: input.provider ?? null,
    modelKey: input.modelKey ?? null,
    purpose: input.purpose ?? null,
    promptTokens: input.promptTokens ?? null,
    completionTokens: input.completionTokens ?? null,
    totalTokens,
    estimatedCost: input.estimatedCost ?? null,
    latencyMs: input.latencyMs ?? null,
    status: input.status,
    errorMessage: input.errorMessage ?? null,
    createdAt: now(),
  });
}

function withinHours(ts: string, hours: number, refMs: number): boolean {
  const t = Date.parse(ts);
  return !Number.isNaN(t) && refMs - t <= hours * 3_600_000;
}

export async function listAiUsageEvents(
  tenantId: string,
  filters: { runType?: string; modelKey?: string; limit?: number } = {},
): Promise<AiUsageEvent[]> {
  const rows = (
    await db.aiUsageEvents.list(tenantId, (e) => {
      if (filters.runType && e.runType !== filters.runType) return false;
      if (filters.modelKey && e.modelKey !== filters.modelKey) return false;
      return true;
    })
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return filters.limit ? rows.slice(0, filters.limit) : rows;
}

export async function getCostSummary(tenantId: string, windowHours = 24): Promise<CostMetrics> {
  const refMs = Date.parse(now());
  const events = (await db.aiUsageEvents.list(tenantId)).filter((e) =>
    withinHours(e.createdAt, windowHours, refMs),
  );
  const byModelMap = new Map<string, { cost: number; tokens: number }>();
  let estimatedCost = 0;
  for (const e of events) {
    estimatedCost += e.estimatedCost ?? 0;
    const key = e.modelKey ?? "unknown";
    const agg = byModelMap.get(key) ?? { cost: 0, tokens: 0 };
    agg.cost += e.estimatedCost ?? 0;
    agg.tokens += e.totalTokens ?? 0;
    byModelMap.set(key, agg);
  }
  return {
    estimatedCost,
    byModel: [...byModelMap.entries()]
      .map(([modelKey, v]) => ({ modelKey, cost: v.cost, tokens: v.tokens }))
      .sort((a, b) => b.cost - a.cost),
  };
}

export async function getLatencySummary(
  tenantId: string,
  windowHours = 24,
): Promise<LatencyMetrics> {
  const refMs = Date.parse(now());
  const latencies = (await db.aiUsageEvents.list(tenantId))
    .filter((e) => withinHours(e.createdAt, windowHours, refMs) && e.latencyMs != null)
    .map((e) => e.latencyMs as number)
    .sort((a, b) => a - b);
  if (latencies.length === 0) return { averageMs: 0, p95Ms: 0 };
  const avg = latencies.reduce((s, x) => s + x, 0) / latencies.length;
  const p95 = latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))]!;
  return { averageMs: Math.round(avg), p95Ms: p95 };
}
