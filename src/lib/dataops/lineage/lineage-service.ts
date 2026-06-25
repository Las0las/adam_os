// Lineage emission (§15 lineage/, §19). Records the provenance edge from a
// source artifact to a produced canonical/ontology artifact.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import type { ActorContext } from "@/types/platform";
import type { LineageEvent } from "@/types/dataops";

export function emitLineage(
  ctx: ActorContext,
  event: {
    pipelineRunId?: string | null;
    kind: string;
    from?: { type: string; id: string } | null;
    to: { type: string; id: string };
    metadata?: Record<string, unknown>;
  },
): LineageEvent {
  return db.lineageEvents.insert({
    id: id("lin"),
    tenantId: ctx.tenantId,
    pipelineRunId: event.pipelineRunId ?? null,
    kind: event.kind,
    fromType: event.from?.type ?? null,
    fromId: event.from?.id ?? null,
    toType: event.to.type,
    toId: event.to.id,
    metadata: event.metadata ?? {},
    createdAt: now(),
  });
}

export function lineageFor(ctx: ActorContext, objectId: string): LineageEvent[] {
  return db.lineageEvents.list(ctx.tenantId, (e) => e.fromId === objectId || e.toId === objectId);
}
