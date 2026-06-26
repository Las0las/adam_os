import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { run, parseBody } from "@/lib/app/route-helpers";
import { markLearningSignalImplemented } from "@/lib/aiops/learning/learning-review-service";

export const dynamic = "force-dynamic";

const ImplementedSchema = z.object({ releaseBundleId: z.string().optional() });

// POST /api/learning/signals/[signalId]/implemented  body: { releaseBundleId? }
export async function POST(request: Request, { params }: { params: { signalId: string } }) {
  const ctx = await appContext();
  return run(async () => {
    const body = await parseBody(request, ImplementedSchema);
    return markLearningSignalImplemented(ctx, params.signalId, body);
  });
}
