import { appContext } from "@/lib/app/demo-context";
import { ok, run, readJson } from "@/lib/app/route-helpers";
import { recordFeedback, listFeedback, type RecordFeedbackInput } from "@/lib/aiops/learning/human-feedback-service";

export const dynamic = "force-dynamic";

// GET /api/learning/feedback
export async function GET() {
  const ctx = await appContext();
  return ok(await listFeedback(ctx.tenantId));
}

// POST /api/learning/feedback  body: RecordFeedbackInput
export async function POST(request: Request) {
  const ctx = await appContext();
  const body = await readJson<RecordFeedbackInput>(request);
  return run(() => recordFeedback(ctx, body));
}
