import { appContext } from "@/lib/app/demo-context";
import { run, readJson } from "@/lib/app/route-helpers";
import { uninstallDomainPack } from "@/lib/domain-packs/domain-pack-uninstaller";

export const dynamic = "force-dynamic";

// POST /api/domain-packs/[packKey]/uninstall  body: { removeDemoData? }
export async function POST(request: Request, { params }: { params: { packKey: string } }) {
  const ctx = await appContext();
  const body = await readJson<{ removeDemoData?: boolean }>(request);
  return run(() => uninstallDomainPack(ctx, params.packKey, { removeDemoData: body.removeDemoData }));
}
