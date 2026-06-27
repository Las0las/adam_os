// MS-010 — Event Publisher + Audit Recorder. Builds typed runtime events and
// records them to the audit log (best-effort). Returns the event so the runtime
// can collect them into the MissionExecutionReport.

import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import { now } from "@/lib/lawrence-core/utils/ids";
import type { ActorContext } from "@/types/platform";
import type { MissionEvent, MissionEventType } from "./mission-types";

export function makeMissionEvent(
  type: MissionEventType,
  missionId: string,
  executionId: string,
  extra: { taskId?: string; detail?: Record<string, unknown> } = {},
): MissionEvent {
  return { type, missionId, executionId, taskId: extra.taskId, at: now(), detail: extra.detail };
}

/** Record a runtime event to the audit log (best-effort) and return it. Auditing
 *  SHALL NOT change execution outcome. */
export async function publishMissionEvent(ctx: ActorContext, event: MissionEvent): Promise<MissionEvent> {
  try {
    await emitAudit(
      ctx,
      event.type,
      { type: "mission_execution", id: event.executionId },
      { missionId: event.missionId, taskId: event.taskId ?? null, ...(event.detail ?? {}) },
    );
  } catch {
    // best-effort audit
  }
  return event;
}
