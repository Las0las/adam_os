import { appContext } from "@/lib/app/demo-context";
import { run } from "@/lib/app/route-helpers";
import { reviewLearningSignal } from "@/lib/aiops/learning/learning-review-service";

export const dynamic = "force-dynamic";

// POST /api/learning/signals/[signalId]/review
export async function POST(_request: Request, { params }: { params: { signalId: string } }) {
  const ctx = await appContext();
  return run(() => reviewLearningSignal(ctx, params.signalId));
}
