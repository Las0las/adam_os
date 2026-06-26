import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { run, parseBody } from "@/lib/app/route-helpers";
import { resetDemo } from "@/lib/demo/demo-reset-service";

export const dynamic = "force-dynamic";

const ResetDemoSchema = z.object({ removeTraces: z.boolean().optional() });

// POST /api/demos/[packKey]/[demoKey]/reset  body: { removeTraces? }
export async function POST(request: Request, { params }: { params: { packKey: string; demoKey: string } }) {
  const ctx = await appContext();
  return run(async () => {
    const body = await parseBody(request, ResetDemoSchema);
    return resetDemo(ctx, params.packKey, { removeTraces: body.removeTraces });
  });
}
