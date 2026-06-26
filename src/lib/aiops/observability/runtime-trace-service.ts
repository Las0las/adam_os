// Phase 7 — runtime trace service (§43). Records an observable trace for every
// runtime activity. Stores summaries (not raw sensitive docs) plus metrics and
// citations. On a failed trace it runs the shared failure-threshold check
// (deduped with the Phase 6 runner incidents) and audits critical failures.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import { captureException } from "@/lib/observability/telemetry";
import {
  countRecentFailures,
  maybeRaiseFailureIncident,
} from "@/lib/mission-control/runtime/failure-threshold";
import type { ActorContext } from "@/types/platform";
import type { RuntimeComponentType } from "@/lib/mission-control/runtime/mission-control-hardening-types";
import type { RuntimeTrace, TraceStatus, TraceType } from "./observability-types";

const RUNTIME_COMPONENT_TYPES = new Set<RuntimeComponentType>([
  "pipeline",
  "function",
  "agent",
  "action",
  "notification_rule",
  "model",
  "integration",
]);

export interface CreateTraceInput {
  traceType: TraceType;
  traceId: string;
  componentType?: string | null;
  componentKey?: string | null;
  objectType?: string | null;
  objectId?: string | null;
  status: TraceStatus;
  inputSummary?: Record<string, unknown>;
  outputSummary?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
  citations?: Array<Record<string, unknown>>;
  errors?: string[];
  startedAt?: string | null;
  completedAt?: string | null;
}

export async function createRuntimeTrace(
  ctx: ActorContext,
  input: CreateTraceInput,
): Promise<RuntimeTrace> {
  const trace = await db.runtimeTraces.insert({
    id: id("trace"),
    tenantId: ctx.tenantId,
    traceType: input.traceType,
    traceId: input.traceId,
    componentType: input.componentType ?? null,
    componentKey: input.componentKey ?? null,
    objectType: input.objectType ?? null,
    objectId: input.objectId ?? null,
    status: input.status,
    inputSummary: input.inputSummary ?? {},
    outputSummary: input.outputSummary ?? {},
    metrics: input.metrics ?? {},
    citations: input.citations ?? [],
    errors: input.errors ?? [],
    startedAt: input.startedAt ?? null,
    completedAt: input.completedAt ?? null,
    createdAt: now(),
  });

  if (input.status === "failed" && input.componentType && input.componentKey) {
    await emitAudit(ctx, "observability.trace.created", { type: "runtime_trace", id: trace.id }, {
      traceType: input.traceType,
      componentKey: input.componentKey,
      status: "failed",
    });
    // Export the runtime failure to the telemetry sink (structured log + Sentry).
    void captureException(new Error(input.errors?.[0] ?? `${input.componentKey} failed`), {
      tenantId: ctx.tenantId,
      actorUserId: ctx.actorUserId,
      component: input.componentType,
      traceId: input.traceId,
      tags: { traceType: input.traceType, componentKey: input.componentKey },
      extra: { errors: input.errors ?? [] },
    });
    if (RUNTIME_COMPONENT_TYPES.has(input.componentType as RuntimeComponentType)) {
      const failures = await db.runtimeTraces.list(
        ctx.tenantId,
        (t) => t.componentKey === input.componentKey && t.status === "failed",
      );
      const recentFailures = countRecentFailures(
        failures.map((t) => ({ status: t.status, createdAt: t.createdAt })),
        (t) => t.status === "failed",
      );
      await maybeRaiseFailureIncident(ctx, {
        componentType: input.componentType as RuntimeComponentType,
        componentKey: input.componentKey,
        recentFailures,
      });
    }
  }

  return trace;
}

export async function updateRuntimeTrace(
  ctx: ActorContext,
  traceRowId: string,
  patch: Partial<RuntimeTrace>,
): Promise<RuntimeTrace> {
  const existing = await db.runtimeTraces.get(ctx.tenantId, traceRowId);
  if (!existing) throw new Error(`Runtime trace not found: ${traceRowId}`);
  return await db.runtimeTraces.update(existing.id, patch);
}

export async function listRuntimeTraces(
  tenantId: string,
  filters: { traceType?: TraceType; componentKey?: string; status?: TraceStatus; limit?: number } = {},
): Promise<RuntimeTrace[]> {
  const rows = (
    await db.runtimeTraces.list(tenantId, (t) => {
      if (filters.traceType && t.traceType !== filters.traceType) return false;
      if (filters.componentKey && t.componentKey !== filters.componentKey) return false;
      if (filters.status && t.status !== filters.status) return false;
      return true;
    })
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return filters.limit ? rows.slice(0, filters.limit) : rows;
}

export async function getRuntimeTrace(
  tenantId: string,
  traceRowId: string,
): Promise<RuntimeTrace | undefined> {
  return await db.runtimeTraces.get(tenantId, traceRowId);
}

export async function listRecentFailures(tenantId: string, limit = 20): Promise<RuntimeTrace[]> {
  return await listRuntimeTraces(tenantId, { status: "failed", limit });
}
