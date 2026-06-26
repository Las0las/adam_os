import { appContext } from "@/lib/app/demo-context";
import { run, readJson } from "@/lib/app/route-helpers";
import { bootstrapTenant } from "@/lib/setup/tenant-bootstrap-service";

export const dynamic = "force-dynamic";

// POST /api/setup/install-default-packs  body: { bundleKey?, packKeys? }
export async function POST(request: Request) {
  const ctx = await appContext();
  const body = await readJson<{ bundleKey?: string; packKeys?: string[] }>(request);
  return run(() => bootstrapTenant({ tenantId: ctx.tenantId, bundleKey: body.bundleKey, packKeys: body.packKeys }));
}
