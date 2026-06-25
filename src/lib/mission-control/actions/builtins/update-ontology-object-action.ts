// Builtin action: upsert an ontology object. Customer-affecting -> requires
// approval (§56 #5) and the ontology.admin permission.

import { db } from "@/lib/lawrence-core/db";
import { now } from "@/lib/lawrence-core/utils/ids";
import { registerAction } from "@/lib/mission-control/actions/action-service";
import { upsertObject } from "@/lib/dataops/ontology/object-service";

registerAction({
  key: "update_ontology_object",
  requiredPermission: "ontology.admin",
  requiresApproval: true,
  precondition(_ctx, input) {
    return input.objectType != null ? null : "missing objectType";
  },
  async run(ctx, input) {
    const properties = (input.properties ?? {}) as Record<string, unknown>;
    const status = input.status as string | null | undefined;

    // Prefer an in-place update by objectId (used by Object Detail actions);
    // fall back to upsert-by-externalKey when no id is given.
    if (input.objectId != null) {
      const existing = await db.ontologyObjects.get(ctx.tenantId, String(input.objectId));
      if (existing && existing.objectType === String(input.objectType)) {
        const updated = await db.ontologyObjects.update(existing.id, {
          status: status ?? existing.status,
          properties: { ...existing.properties, ...properties },
          updatedAt: now(),
        });
        return { objectId: updated.id };
      }
    }

    const obj = await upsertObject(ctx, {
      objectType: String(input.objectType),
      externalKey: input.externalKey as string | null | undefined,
      status,
      properties,
    });
    return { objectId: obj.id };
  },
});
