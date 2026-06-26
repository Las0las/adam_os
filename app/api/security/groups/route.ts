import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { ok, run, parseBody } from "@/lib/app/route-helpers";
import { createGroup, listGroupsForUser } from "@/lib/security/group-service";

export const dynamic = "force-dynamic";

const CreateGroupSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
});

// GET /api/security/groups?userId=  — groups for a user (defaults to caller).
export async function GET(request: Request) {
  const ctx = await appContext();
  const userId = new URL(request.url).searchParams.get("userId") ?? ctx.actorUserId ?? "system";
  return ok(await listGroupsForUser(ctx.tenantId, userId));
}

// POST /api/security/groups  body: { key, name, description? }
export async function POST(request: Request) {
  const ctx = await appContext();
  return run(async () => {
    const body = await parseBody(request, CreateGroupSchema);
    return createGroup(ctx, body as Parameters<typeof createGroup>[1]);
  });
}
