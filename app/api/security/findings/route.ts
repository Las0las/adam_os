import { appContext } from "@/lib/app/demo-context";
import { ok } from "@/lib/app/route-helpers";
import { listSecurityFindings } from "@/lib/security/security-finding-service";
import type { SecuritySeverity } from "@/lib/security/security-types";

export const dynamic = "force-dynamic";

// GET /api/security/findings?status=&severity=
export async function GET(request: Request) {
  const ctx = await appContext();
  const url = new URL(request.url);
  const status = url.searchParams.get("status") as
    | "open"
    | "in_review"
    | "resolved"
    | "accepted_risk"
    | null;
  const severity = url.searchParams.get("severity") as SecuritySeverity | null;
  return ok(
    await listSecurityFindings(ctx.tenantId, {
      status: status ?? undefined,
      severity: severity ?? undefined,
    }),
  );
}
