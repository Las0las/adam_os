import { appContext } from "@/lib/app/demo-context";
import { ok } from "@/lib/app/route-helpers";
import { getAllDemos } from "@/lib/demo/demo-script-service";

export const dynamic = "force-dynamic";

// GET /api/demos
export async function GET() {
  await appContext();
  return ok(getAllDemos());
}
