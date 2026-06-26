import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { ok, run, parseBody } from "@/lib/app/route-helpers";
import {
  recordRecommendationOutcome,
  listRecommendationOutcomes,
  type RecordOutcomeInput,
} from "@/lib/aiops/learning/recommendation-outcome-service";

export const dynamic = "force-dynamic";

const OutcomeSchema = z.object({}).passthrough();

// GET /api/learning/recommendation-outcomes
export async function GET() {
  const ctx = await appContext();
  return ok(await listRecommendationOutcomes(ctx.tenantId));
}

// POST /api/learning/recommendation-outcomes  body: RecordOutcomeInput
export async function POST(request: Request) {
  const ctx = await appContext();
  return run(async () => {
    const body = (await parseBody(request, OutcomeSchema)) as unknown as RecordOutcomeInput;
    return recordRecommendationOutcome(ctx, body);
  });
}
