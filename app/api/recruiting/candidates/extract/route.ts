import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { run, parseBody } from "@/lib/app/route-helpers";
import { extractCandidateDraft } from "@/lib/dataops/import/nl/candidate-extraction";

export const dynamic = "force-dynamic";

const ExtractSchema = z.object({
  text: z.string().min(1),
  source: z.string().optional(),
});

// POST /api/recruiting/candidates/extract  body: { text, source? }
// Paste an unstructured profile; returns a review-queue draft (never an
// authoritative Candidate until a reviewer confirms it).
export async function POST(request: Request) {
  const ctx = await appContext();
  return run(async () => {
    const body = await parseBody(request, ExtractSchema);
    const result = await extractCandidateDraft(ctx, { text: body.text, source: body.source });
    return {
      reviewCaseId: result.reviewCase.id,
      extractionId: result.extraction.id,
      status: result.extraction.status,
      confidence: result.confidence,
      proposed: result.proposed,
    };
  });
}
