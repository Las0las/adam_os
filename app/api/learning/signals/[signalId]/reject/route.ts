import { appContext } from "@/lib/app/demo-context";
import { run, readJson } from "@/lib/app/route-helpers";
import { rejectLearningSignal } from "@/lib/aiops/learning/learning-review-service";

export const dynamic = "force-dynamic";

// POST /api/learning/signals/[signalId]/reject  body: { note? }
export async function POST(request: Request, { params }: { params: { signalId: string } }) {
  const ctx = await appContext();
  const body = await readJson<{ note?: string }>(request);
  return run(() => rejectLearningSignal(ctx, params.signalId, body.note));
}
