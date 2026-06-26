// Phase 6 — failure threshold → incident. Shared by the action/function/agent/
// pipeline runners. When a component crosses a failure threshold inside the
// window, a runtime incident is raised (high at 3, critical at 5). Incidents are
// deduped per component within the window so a crashloop yields one incident.

import { db } from "@/lib/lawrence-core/db";
import { now } from "@/lib/lawrence-core/utils/ids";
import { raiseIncident } from "./deployment-service";
import type { ActorContext } from "@/types/platform";
import type { RuntimeComponentType } from "./mission-control-hardening-types";

const WINDOW_MS = 15 * 60 * 1000;
const SOURCE = "runtime_threshold";

/**
 * Record-aware threshold check: callers pass the count of recent failures for
 * the component within the window (including the just-failed run). Returns the
 * raised incident severity, or null if below threshold / deduped.
 */
export async function maybeRaiseFailureIncident(
  ctx: ActorContext,
  input: { componentType: RuntimeComponentType; componentKey: string; recentFailures: number },
): Promise<"high" | "critical" | null> {
  const severity: "high" | "critical" | null =
    input.recentFailures >= 5 ? "critical" : input.recentFailures >= 3 ? "high" : null;
  if (!severity) return null;

  const refMs = Date.parse(now());
  const marker = `${input.componentType}:${input.componentKey}`;

  // Dedupe: skip if an open threshold incident for this component exists in-window.
  const existing = await db.runtimeIncidents.find(
    ctx.tenantId,
    (i) =>
      i.status !== "resolved" &&
      i.source === SOURCE &&
      i.detail === marker &&
      refMs - Date.parse(i.createdAt) <= WINDOW_MS,
  );
  if (existing) {
    // Escalate an existing high incident to critical if we crossed 5.
    if (severity === "critical" && existing.severity !== "critical") {
      await db.runtimeIncidents.update(existing.id, { severity: "critical" });
      return "critical";
    }
    return null;
  }

  await raiseIncident(ctx, {
    title: `${marker} crossed failure threshold (${input.recentFailures} in 15m)`,
    severity,
    source: SOURCE,
    detail: marker,
  });
  return severity;
}

/** Count recent failures for a component from a run collection's rows. */
export function countRecentFailures(
  rows: Array<{ status?: string; state?: string; createdAt: string }>,
  isFailure: (r: { status?: string; state?: string }) => boolean,
): number {
  const refMs = Date.parse(now());
  return rows.filter(
    (r) => isFailure(r) && refMs - Date.parse(r.createdAt) <= WINDOW_MS,
  ).length;
}
