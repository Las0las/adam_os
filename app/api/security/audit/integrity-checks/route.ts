import { appContext } from "@/lib/app/demo-context";
import { ok } from "@/lib/app/route-helpers";
import { listIntegrityChecks } from "@/lib/security/audit-integrity-service";

export const dynamic = "force-dynamic";

// GET /api/security/audit/integrity-checks
export async function GET() {
  const ctx = await appContext();
  return ok(await listIntegrityChecks(ctx.tenantId));
}
