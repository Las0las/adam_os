import { appContext } from "@/lib/app/demo-context";
import { run, readJson } from "@/lib/app/route-helpers";
import { markLearningSignalImplemented } from "@/lib/aiops/learning/learning-review-service";

export const dynamic = "force-dynamic";

// POST /api/learning/signals/[signalId]/implemented  body: { releaseBundleId? }
export async function POST(request: Request, { params }: { params: { signalId: string } }) {
  const ctx = await appContext();
  const body = await readJson<{ releaseBundleId?: string }>(request);
  return run(() => markLearningSignalImplemented(ctx, params.signalId, body));
}
