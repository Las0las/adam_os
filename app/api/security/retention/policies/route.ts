import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { ok, run, parseBody } from "@/lib/app/route-helpers";
import {
  createRetentionPolicy,
  listRetentionPolicies,
} from "@/lib/security/retention-service";

export const dynamic = "force-dynamic";

const RetentionPolicySchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  objectType: z.string().min(1),
  retentionDays: z.number(),
  action: z.string().min(1),
  config: z.record(z.unknown()).optional(),
});

// GET /api/security/retention/policies
export async function GET() {
  const ctx = await appContext();
  return ok(await listRetentionPolicies(ctx.tenantId));
}

// POST /api/security/retention/policies
// body: { key, name, objectType, retentionDays, action, config? }
export async function POST(request: Request) {
  const ctx = await appContext();
  return run(async () => {
    const body = await parseBody(request, RetentionPolicySchema);
    return createRetentionPolicy(ctx, body as Parameters<typeof createRetentionPolicy>[1]);
  });
}
