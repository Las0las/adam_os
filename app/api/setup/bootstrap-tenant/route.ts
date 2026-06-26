import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { run, parseBody } from "@/lib/app/route-helpers";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import { bootstrapTenant } from "@/lib/setup/tenant-bootstrap-service";
import type { BootstrapTenantInput } from "@/lib/setup/tenant-bootstrap-types";

export const dynamic = "force-dynamic";

const BootstrapTenantSchema = z.object({}).passthrough();

// POST /api/setup/bootstrap-tenant
export async function POST(request: Request) {
  const ctx = await appContext();
  requirePermission(ctx, "mission_control.admin");
  return run(async () => {
    const body = (await parseBody(request, BootstrapTenantSchema)) as unknown as BootstrapTenantInput;
    return bootstrapTenant({ ...body, tenantId: body.tenantId ?? ctx.tenantId });
  });
}
