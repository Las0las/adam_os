import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { run, parseBody } from "@/lib/app/route-helpers";
import { uninstallDomainPack } from "@/lib/domain-packs/domain-pack-uninstaller";

export const dynamic = "force-dynamic";

const UninstallSchema = z.object({ removeDemoData: z.boolean().optional() });

// POST /api/domain-packs/[packKey]/uninstall  body: { removeDemoData? }
export async function POST(request: Request, { params }: { params: { packKey: string } }) {
  const ctx = await appContext();
  return run(async () => {
    const body = await parseBody(request, UninstallSchema);
    return uninstallDomainPack(ctx, params.packKey, { removeDemoData: body.removeDemoData });
  });
}
