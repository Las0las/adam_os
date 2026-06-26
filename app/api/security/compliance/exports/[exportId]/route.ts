import { appContext } from "@/lib/app/demo-context";
import { ok, fail } from "@/lib/app/route-helpers";
import { getComplianceExportBundle } from "@/lib/security/compliance-export-service";

export const dynamic = "force-dynamic";

// GET /api/security/compliance/exports/:exportId  — returns the sealed bundle.
export async function GET(
  _request: Request,
  { params }: { params: { exportId: string } },
) {
  const ctx = await appContext();
  try {
    const result = await getComplianceExportBundle(ctx, params.exportId);
    if (!result) return fail("compliance export not found", 404);
    return ok(result);
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err), 403);
  }
}
