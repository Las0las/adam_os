import { appContext } from "@/lib/app/demo-context";
import { ok, fail } from "@/lib/app/route-helpers";
import { getDomainPackDetail } from "@/lib/domain-packs/domain-pack-service";

export const dynamic = "force-dynamic";

// GET /api/domain-packs/[packKey]
export async function GET(_request: Request, { params }: { params: { packKey: string } }) {
  const ctx = await appContext();
  const detail = await getDomainPackDetail(ctx, params.packKey);
  if (!detail) return fail("pack not found", 404);
  return ok(detail);
}
