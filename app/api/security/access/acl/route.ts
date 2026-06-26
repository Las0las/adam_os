import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { run, parseBody } from "@/lib/app/route-helpers";
import { setObjectAcl } from "@/lib/security/object-acl-service";

export const dynamic = "force-dynamic";

const AclSchema = z.object({
  objectType: z.string().min(1),
  objectId: z.string().min(1),
  principalType: z.enum(["user", "group", "role"]),
  principalId: z.string().min(1),
  permission: z.string().min(1),
  effect: z.string().optional(),
});

// POST /api/security/access/acl
// body: { objectType, objectId, principalType, principalId, permission, effect? }
export async function POST(request: Request) {
  const ctx = await appContext();
  return run(async () => {
    const body = await parseBody(request, AclSchema);
    return setObjectAcl(ctx, body as Parameters<typeof setObjectAcl>[1]);
  });
}
