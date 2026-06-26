import { appContext } from "@/lib/app/demo-context";
import { ok, run, readJson } from "@/lib/app/route-helpers";
import {
  createComplianceExport,
  listComplianceExports,
} from "@/lib/security/compliance-export-service";
import type { ComplianceExportType } from "@/lib/security/compliance-types";

export const dynamic = "force-dynamic";

// GET /api/security/compliance/exports
export async function GET() {
  const ctx = await appContext();
  return ok(await listComplianceExports(ctx.tenantId));
}

// POST /api/security/compliance/exports  body: { exportType, parameters? }
export async function POST(request: Request) {
  const ctx = await appContext();
  const body = await readJson<{ exportType: ComplianceExportType; parameters?: Record<string, unknown> }>(request);
  return run(() => createComplianceExport(ctx, body.exportType, body.parameters ?? {}));
}
