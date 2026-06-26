import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { run, parseBody } from "@/lib/app/route-helpers";
import { runDemoStep } from "@/lib/demo/demo-runner";

export const dynamic = "force-dynamic";

const RunStepSchema = z.object({ stepKey: z.string().min(1) });

// POST /api/demos/[packKey]/[demoKey]/run-step  body: { stepKey }
export async function POST(request: Request, { params }: { params: { packKey: string; demoKey: string } }) {
  const ctx = await appContext();
  return run(async () => {
    const body = await parseBody(request, RunStepSchema);
    return runDemoStep(ctx, params.packKey, params.demoKey, body.stepKey);
  });
}
