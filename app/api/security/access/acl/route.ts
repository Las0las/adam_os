import { appContext } from "@/lib/app/demo-context";
import { run, readJson } from "@/lib/app/route-helpers";
import { setObjectAcl } from "@/lib/security/object-acl-service";
import type { AclEffect, ObjectPermission } from "@/lib/security/access-control-types";

export const dynamic = "force-dynamic";

// POST /api/security/access/acl
// body: { objectType, objectId, principalType, principalId, permission, effect? }
export async function POST(request: Request) {
  const ctx = await appContext();
  const body = await readJson<{
    objectType: string;
    objectId: string;
    principalType: "user" | "group" | "role";
    principalId: string;
    permission: ObjectPermission;
    effect?: AclEffect;
  }>(request);
  return run(() => setObjectAcl(ctx, body));
}
