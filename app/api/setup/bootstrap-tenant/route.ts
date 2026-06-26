import { appContext } from "@/lib/app/demo-context";
import { run, readJson } from "@/lib/app/route-helpers";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import { bootstrapTenant } from "@/lib/setup/tenant-bootstrap-service";
import type { BootstrapTenantInput } from "@/lib/setup/tenant-bootstrap-types";

export const dynamic = "force-dynamic";

// POST /api/setup/bootstrap-tenant
export async function POST(request: Request) {
  const ctx = await appContext();
  requirePermission(ctx, "mission_control.admin");
  const body = await readJson<BootstrapTenantInput>(request);
  return run(() => bootstrapTenant({ ...body, tenantId: body.tenantId ?? ctx.tenantId }));
}
