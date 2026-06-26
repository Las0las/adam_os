import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { run, parseBody } from "@/lib/app/route-helpers";
import { rejectLearningSignal } from "@/lib/aiops/learning/learning-review-service";

export const dynamic = "force-dynamic";

const RejectSignalSchema = z.object({ note: z.string().optional() });

// POST /api/learning/signals/[signalId]/reject  body: { note? }
export async function POST(request: Request, { params }: { params: { signalId: string } }) {
  const ctx = await appContext();
  return run(async () => {
    const body = await parseBody(request, RejectSignalSchema);
    return rejectLearningSignal(ctx, params.signalId, body.note);
  });
}
