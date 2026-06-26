import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { run, parseBody } from "@/lib/app/route-helpers";
import { extractJobDraft } from "@/lib/dataops/import/nl/job-extraction";

export const dynamic = "force-dynamic";

const ExtractSchema = z.object({
  text: z.string().min(1),
  source: z.string().optional(),
});

// POST /api/recruiting/jobs/extract  body: { text, source? }
// Paste an unstructured job description; returns a review-queue draft (never an
// authoritative Job until a reviewer confirms it).
export async function POST(request: Request) {
  const ctx = await appContext();
  return run(async () => {
    const body = await parseBody(request, ExtractSchema);
    const result = await extractJobDraft(ctx, { text: body.text, source: body.source });
    return {
      reviewCaseId: result.reviewCase.id,
      extractionId: result.extraction.id,
      status: result.extraction.status,
      confidence: result.confidence,
      proposed: result.proposed,
    };
  });
}
