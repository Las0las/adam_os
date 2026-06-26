import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { run, parseBody } from "@/lib/app/route-helpers";
import { bootstrapTenant } from "@/lib/setup/tenant-bootstrap-service";

export const dynamic = "force-dynamic";

const InstallPacksSchema = z.object({
  bundleKey: z.string().optional(),
  packKeys: z.array(z.string()).optional(),
});

// POST /api/setup/install-default-packs  body: { bundleKey?, packKeys? }
export async function POST(request: Request) {
  const ctx = await appContext();
  return run(async () => {
    const body = await parseBody(request, InstallPacksSchema);
    return bootstrapTenant({ tenantId: ctx.tenantId, bundleKey: body.bundleKey, packKeys: body.packKeys });
  });
}
