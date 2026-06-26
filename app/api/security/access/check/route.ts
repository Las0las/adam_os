import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { run, parseBody } from "@/lib/app/route-helpers";
import { checkObjectAccessForActor } from "@/lib/security/access-guard";
import type { ObjectPermission } from "@/lib/security/access-control-types";

export const dynamic = "force-dynamic";

const AccessCheckSchema = z.object({
  objectType: z.string().min(1),
  objectId: z.string().min(1),
  permission: z.string().min(1),
  objectTenantId: z.string().nullable().optional(),
});

// POST /api/security/access/check
// body: { objectType, objectId, permission, objectTenantId? }
export async function POST(request: Request) {
  const ctx = await appContext();
  return run(async () => {
    const body = await parseBody(request, AccessCheckSchema);
    return checkObjectAccessForActor(ctx, {
      objectType: body.objectType,
      objectId: body.objectId,
      permission: body.permission as ObjectPermission,
      objectTenantId: body.objectTenantId ?? ctx.tenantId,
    });
  });
}
