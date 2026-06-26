import { appContext } from "@/lib/app/demo-context";
import { run } from "@/lib/app/route-helpers";
import { runDemo } from "@/lib/demo/demo-runner";

export const dynamic = "force-dynamic";

// POST /api/demos/[packKey]/[demoKey]/run
export async function POST(_request: Request, { params }: { params: { packKey: string; demoKey: string } }) {
  const ctx = await appContext();
  return run(() => runDemo(ctx, params.packKey, params.demoKey));
}
