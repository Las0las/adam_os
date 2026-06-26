import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { run, parseBody } from "@/lib/app/route-helpers";
import { acceptLearningSignal } from "@/lib/aiops/learning/learning-review-service";

export const dynamic = "force-dynamic";

const AcceptSignalSchema = z.object({
  createReviewCase: z.boolean().optional(),
  note: z.string().optional(),
});

// POST /api/learning/signals/[signalId]/accept  body: { createReviewCase?, note? }
export async function POST(request: Request, { params }: { params: { signalId: string } }) {
  const ctx = await appContext();
  return run(async () => {
    const body = await parseBody(request, AcceptSignalSchema);
    return acceptLearningSignal(ctx, params.signalId, body);
  });
}
