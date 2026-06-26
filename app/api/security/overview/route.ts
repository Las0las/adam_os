import { appContext } from "@/lib/app/demo-context";
import { ok } from "@/lib/app/route-helpers";
import { getSecurityPosture } from "@/lib/security/security-overview-service";

export const dynamic = "force-dynamic";

// GET /api/security/overview — aggregate security posture for the dashboard.
export async function GET() {
  const ctx = await appContext();
  return ok(await getSecurityPosture(ctx));
}
