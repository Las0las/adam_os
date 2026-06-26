import { appContext } from "@/lib/app/demo-context";
import { run, fail } from "@/lib/app/route-helpers";
import { installDomainPack } from "@/lib/domain-packs/domain-pack-installer";
import { getDomainPackManifest } from "@/lib/domain-packs/domain-pack-registry";
import "@/lib/domain-packs/packs";

export const dynamic = "force-dynamic";

// POST /api/domain-packs/[packKey]/install
export async function POST(_request: Request, { params }: { params: { packKey: string } }) {
  const ctx = await appContext();
  const manifest = getDomainPackManifest(params.packKey);
  if (!manifest) return fail("pack not found", 404);
  return run(() => installDomainPack(ctx, manifest, { actorUserId: ctx.actorUserId }));
}
