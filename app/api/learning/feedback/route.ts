import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { ok, run, parseBody } from "@/lib/app/route-helpers";
import { recordFeedback, listFeedback, type RecordFeedbackInput } from "@/lib/aiops/learning/human-feedback-service";

export const dynamic = "force-dynamic";

// Object-shape guard; the service validates the specific fields.
const FeedbackSchema = z.object({}).passthrough();

// GET /api/learning/feedback
export async function GET() {
  const ctx = await appContext();
  return ok(await listFeedback(ctx.tenantId));
}

// POST /api/learning/feedback  body: RecordFeedbackInput
export async function POST(request: Request) {
  const ctx = await appContext();
  return run(async () => {
    const body = (await parseBody(request, FeedbackSchema)) as unknown as RecordFeedbackInput;
    return recordFeedback(ctx, body);
  });
}
