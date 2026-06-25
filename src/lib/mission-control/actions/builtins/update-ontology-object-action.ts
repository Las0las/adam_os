// Builtin action: upsert an ontology object. Customer-affecting -> requires
// approval (§56 #5) and the ontology.admin permission.

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
    const obj = await upsertObject(ctx, {
      objectType: String(input.objectType),
      externalKey: input.externalKey as string | null | undefined,
      status: input.status as string | null | undefined,
      properties: (input.properties ?? {}) as Record<string, unknown>,
    });
    return { objectId: obj.id };
  },
});
