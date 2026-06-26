import { appContext } from "@/lib/app/demo-context";
import { ok, run, readJson } from "@/lib/app/route-helpers";
import { createGroup, listGroupsForUser } from "@/lib/security/group-service";

export const dynamic = "force-dynamic";

// GET /api/security/groups?userId=  — groups for a user (defaults to caller).
export async function GET(request: Request) {
  const ctx = await appContext();
  const userId = new URL(request.url).searchParams.get("userId") ?? ctx.actorUserId ?? "system";
  return ok(await listGroupsForUser(ctx.tenantId, userId));
}

// POST /api/security/groups  body: { key, name, description? }
export async function POST(request: Request) {
  const ctx = await appContext();
  const body = await readJson<{ key: string; name: string; description?: string }>(request);
  return run(() => createGroup(ctx, body));
}
