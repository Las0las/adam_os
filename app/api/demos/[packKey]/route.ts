import { appContext } from "@/lib/app/demo-context";
import { ok } from "@/lib/app/route-helpers";
import { getPackDemos } from "@/lib/demo/demo-script-service";

export const dynamic = "force-dynamic";

// GET /api/demos/[packKey]
export async function GET(_request: Request, { params }: { params: { packKey: string } }) {
  await appContext();
  return ok(getPackDemos(params.packKey));
}
