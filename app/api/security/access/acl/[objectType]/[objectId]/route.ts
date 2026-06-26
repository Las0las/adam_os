import { appContext } from "@/lib/app/demo-context";
import { ok } from "@/lib/app/route-helpers";
import { listAclsForObject } from "@/lib/security/object-acl-service";

export const dynamic = "force-dynamic";

// GET /api/security/access/acl/:objectType/:objectId
export async function GET(
  _request: Request,
  { params }: { params: { objectType: string; objectId: string } },
) {
  const ctx = await appContext();
  return ok(await listAclsForObject(ctx.tenantId, params.objectType, params.objectId));
}
