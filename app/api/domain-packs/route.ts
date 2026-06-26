import { appContext } from "@/lib/app/demo-context";
import { ok } from "@/lib/app/route-helpers";
import { getDomainPackCatalog } from "@/lib/domain-packs/domain-pack-service";

export const dynamic = "force-dynamic";

// GET /api/domain-packs
export async function GET() {
  const ctx = await appContext();
  return ok(await getDomainPackCatalog(ctx));
}
