import { appContext } from "@/lib/app/demo-context";
import { ok, run, readJson } from "@/lib/app/route-helpers";
import {
  recordRecommendationOutcome,
  listRecommendationOutcomes,
  type RecordOutcomeInput,
} from "@/lib/aiops/learning/recommendation-outcome-service";

export const dynamic = "force-dynamic";

// GET /api/learning/recommendation-outcomes
export async function GET() {
  const ctx = await appContext();
  return ok(await listRecommendationOutcomes(ctx.tenantId));
}

// POST /api/learning/recommendation-outcomes  body: RecordOutcomeInput
export async function POST(request: Request) {
  const ctx = await appContext();
  const body = await readJson<RecordOutcomeInput>(request);
  return run(() => recordRecommendationOutcome(ctx, body));
}
