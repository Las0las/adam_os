import { appContext } from "@/lib/app/demo-context";
import { run, readJson } from "@/lib/app/route-helpers";
import { checkObjectAccessForActor } from "@/lib/security/access-guard";
import type { ObjectPermission } from "@/lib/security/access-control-types";

export const dynamic = "force-dynamic";

// POST /api/security/access/check
// body: { objectType, objectId, permission, objectTenantId? }
export async function POST(request: Request) {
  const ctx = await appContext();
  const body = await readJson<{
    objectType: string;
    objectId: string;
    permission: ObjectPermission;
    objectTenantId?: string | null;
  }>(request);
  return run(() =>
    checkObjectAccessForActor(ctx, {
      objectType: body.objectType,
      objectId: body.objectId,
      permission: body.permission,
      objectTenantId: body.objectTenantId ?? ctx.tenantId,
    }),
  );
}
