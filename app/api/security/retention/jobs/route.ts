import { appContext } from "@/lib/app/demo-context";
import { ok } from "@/lib/app/route-helpers";
import { listRetentionJobs } from "@/lib/security/retention-service";

export const dynamic = "force-dynamic";

// GET /api/security/retention/jobs
export async function GET() {
  const ctx = await appContext();
  return ok(await listRetentionJobs(ctx.tenantId));
}
