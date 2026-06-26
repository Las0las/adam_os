import { appContext } from "@/lib/app/demo-context";
import { run, readJson } from "@/lib/app/route-helpers";
import { runDemoStep } from "@/lib/demo/demo-runner";

export const dynamic = "force-dynamic";

// POST /api/demos/[packKey]/[demoKey]/run-step  body: { stepKey }
export async function POST(request: Request, { params }: { params: { packKey: string; demoKey: string } }) {
  const ctx = await appContext();
  const body = await readJson<{ stepKey: string }>(request);
  return run(() => runDemoStep(ctx, params.packKey, params.demoKey, body.stepKey));
}
