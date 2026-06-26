import { appContext } from "@/lib/app/demo-context";
import { run, readJson } from "@/lib/app/route-helpers";
import { acceptLearningSignal } from "@/lib/aiops/learning/learning-review-service";

export const dynamic = "force-dynamic";

// POST /api/learning/signals/[signalId]/accept  body: { createReviewCase?, note? }
export async function POST(request: Request, { params }: { params: { signalId: string } }) {
  const ctx = await appContext();
  const body = await readJson<{ createReviewCase?: boolean; note?: string }>(request);
  return run(() => acceptLearningSignal(ctx, params.signalId, body));
}
