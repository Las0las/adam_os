// MS-011 — durable Mission Execution persistence. Turns the in-memory
// MissionExecutionReport into a tenant-scoped, queryable record so executions are
// observable and auditable beyond the originating call. Uses the standard
// Collection seam (in-memory + lazy-DDL Postgres) like every other runtime record.

import { db } from "@/lib/lawrence-core/db";
import { now } from "@/lib/lawrence-core/utils/ids";
import type { ActorContext } from "@/types/platform";
import type { MissionExecutionRecord, MissionExecutionReport } from "./mission-types";

/** Persist a mission execution report as a durable record. Not swallowed: a
 *  persistence failure propagates (fail-closed) rather than silently dropping the
 *  execution record. */
export async function persistMissionExecution(
  ctx: ActorContext,
  report: MissionExecutionReport,
): Promise<MissionExecutionRecord> {
  return db.missionExecutions.insert({
    id: report.executionId,
    tenantId: ctx.tenantId,
    createdAt: now(),
    report,
  });
}

export async function getMissionExecution(
  ctx: ActorContext,
  executionId: string,
): Promise<MissionExecutionRecord | undefined> {
  return db.missionExecutions.get(ctx.tenantId, executionId);
}

export async function listMissionExecutions(
  ctx: ActorContext,
  missionId?: string,
): Promise<MissionExecutionRecord[]> {
  return db.missionExecutions.list(
    ctx.tenantId,
    missionId ? (r) => r.report.missionId === missionId : undefined,
  );
}
