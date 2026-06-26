import { appContext } from "@/lib/app/demo-context";
import { ok, run, readJson } from "@/lib/app/route-helpers";
import {
  createRetentionPolicy,
  listRetentionPolicies,
} from "@/lib/security/retention-service";
import type { RetentionAction } from "@/lib/security/compliance-types";

export const dynamic = "force-dynamic";

// GET /api/security/retention/policies
export async function GET() {
  const ctx = await appContext();
  return ok(await listRetentionPolicies(ctx.tenantId));
}

// POST /api/security/retention/policies
// body: { key, name, objectType, retentionDays, action, config? }
export async function POST(request: Request) {
  const ctx = await appContext();
  const body = await readJson<{
    key: string;
    name: string;
    objectType: string;
    retentionDays: number;
    action: RetentionAction;
    config?: Record<string, unknown>;
  }>(request);
  return run(() => createRetentionPolicy(ctx, body));
}
