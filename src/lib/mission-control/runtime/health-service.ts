// Phase 6 — runtime health service. Probes a component's wiring and records a
// health check, updating the component's last-known health. Checks are
// structural (does the definition/handler/config exist) — not synthetic load.

import { db } from "@/lib/lawrence-core/db";
import { resolveFunction } from "@/lib/aiops/functions/function-registry";
import { resolveAction } from "../actions/action-service";
import { recordHealthCheck } from "./health-check-repository";
import { setRuntimeComponentStatus, listRuntimeComponents } from "./runtime-component-repository";
import type { ActorContext } from "@/types/platform";
import type {
  HealthStatus,
  RuntimeComponentType,
  RuntimeHealthCheck,
} from "./mission-control-hardening-types";

async function probe(
  ctx: ActorContext,
  componentType: RuntimeComponentType,
  componentKey: string,
): Promise<{ status: HealthStatus; message: string }> {
  switch (componentType) {
    case "pipeline": {
      const def = await db.pipelineDefinitions.find(
        ctx.tenantId,
        (p) => p.name === componentKey || p.id === componentKey,
      );
      return def
        ? { status: "healthy", message: "pipeline definition present" }
        : { status: "failed", message: "pipeline definition missing" };
    }
    case "function": {
      const registered = resolveFunction(componentKey);
      const hasModel = (await db.modelDefinitions.list(ctx.tenantId, (m) => m.status === "active")).length > 0;
      if (!registered) return { status: "failed", message: "function not registered" };
      return hasModel
        ? { status: "healthy", message: "function registered with active model" }
        : { status: "degraded", message: "function registered but no active model definition" };
    }
    case "agent": {
      const def = await db.agentDefinitions.find(ctx.tenantId, (a) => a.key === componentKey);
      if (!def) return { status: "failed", message: "agent definition missing" };
      return def.graph?.nodes?.length
        ? { status: "healthy", message: "agent graph valid" }
        : { status: "degraded", message: "agent graph has no nodes" };
    }
    case "action": {
      return resolveAction(componentKey)
        ? { status: "healthy", message: "action handler registered" }
        : { status: "failed", message: "action handler not registered" };
    }
    case "model": {
      const def = await db.modelDefinitions.find(
        ctx.tenantId,
        (m) => m.modelKey === componentKey || m.id === componentKey,
      );
      return def
        ? { status: "healthy", message: "model definition present" }
        : { status: "degraded", message: "no matching model definition" };
    }
    case "notification_rule": {
      const rule = await db.notificationRules.find(ctx.tenantId, (r) => r.name === componentKey || r.id === componentKey);
      return rule
        ? { status: "healthy", message: "notification rule present" }
        : { status: "degraded", message: "notification rule missing" };
    }
    case "integration":
    default:
      return { status: "unknown", message: "no structural probe for component type" };
  }
}

const HEALTH_TO_COMPONENT_STATUS = {
  healthy: "enabled",
  degraded: "degraded",
  failed: "failed",
  unknown: "enabled",
} as const;

export async function runHealthCheckForComponent(
  ctx: ActorContext,
  input: { componentType: RuntimeComponentType; componentKey: string; environmentId?: string | null },
): Promise<RuntimeHealthCheck> {
  const { status, message } = await probe(ctx, input.componentType, input.componentKey);
  const check = await recordHealthCheck({
    tenantId: ctx.tenantId,
    componentType: input.componentType,
    componentKey: input.componentKey,
    environmentId: input.environmentId ?? null,
    status,
    message,
  });

  // Reflect health onto the component status — but never override a kill-switch
  // disable (only move enabled<->degraded/failed).
  if (status !== "unknown") {
    await setRuntimeComponentStatus({
      tenantId: ctx.tenantId,
      componentType: input.componentType,
      componentKey: input.componentKey,
      environmentId: input.environmentId ?? null,
      status: HEALTH_TO_COMPONENT_STATUS[status],
      lastHealthStatus: status,
    });
  }

  return check;
}

/** Probe every registered runtime component for the tenant. */
export async function runAllHealthChecks(ctx: ActorContext): Promise<RuntimeHealthCheck[]> {
  const components = await listRuntimeComponents(ctx.tenantId);
  const out: RuntimeHealthCheck[] = [];
  for (const c of components) {
    if (c.status === "disabled") continue; // kill-switched: skip probing
    out.push(
      await runHealthCheckForComponent(ctx, {
        componentType: c.componentType,
        componentKey: c.componentKey,
        environmentId: c.environmentId,
      }),
    );
  }
  return out;
}
