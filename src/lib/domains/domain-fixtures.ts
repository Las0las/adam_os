// Phase 4 — shared fixture helpers (Part A). Used by seed packs to attach
// evidence to seeded ontology objects through the real Evidence Fabric.

import { indexEvidence } from "@/lib/dataops/evidence/chunking-service";
import type { ActorContext } from "@/types/platform";

/** Index each evidence string as chunks linked to an ontology object. */
export async function seedObjectEvidence(
  ctx: ActorContext,
  objectType: string,
  objectId: string,
  texts: string[],
  metadata: Record<string, unknown> = {},
): Promise<void> {
  for (const text of texts) {
    if (text.trim()) {
      await indexEvidence(ctx, { objectType, objectId }, text, metadata);
    }
  }
}
