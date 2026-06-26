import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { ok, run, parseBody } from "@/lib/app/route-helpers";
import {
  createComplianceExport,
  listComplianceExports,
} from "@/lib/security/compliance-export-service";
import type { ComplianceExportType } from "@/lib/security/compliance-types";

export const dynamic = "force-dynamic";

const ComplianceExportSchema = z.object({
  exportType: z.string().min(1),
  parameters: z.record(z.unknown()).optional(),
});

// GET /api/security/compliance/exports
export async function GET() {
  const ctx = await appContext();
  return ok(await listComplianceExports(ctx.tenantId));
}

// POST /api/security/compliance/exports  body: { exportType, parameters? }
export async function POST(request: Request) {
  const ctx = await appContext();
  return run(async () => {
    const body = await parseBody(request, ComplianceExportSchema);
    return createComplianceExport(ctx, body.exportType as ComplianceExportType, body.parameters ?? {});
  });
}
