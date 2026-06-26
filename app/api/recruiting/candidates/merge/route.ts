import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { run, parseBody } from "@/lib/app/route-helpers";
import { mergeCandidates } from "@/lib/domains/recruiting/candidate-identity-service";

export const dynamic = "force-dynamic";

const MergeSchema = z.object({
  survivorId: z.string().min(1),
  duplicateId: z.string().min(1),
  note: z.string().optional(),
});

// POST /api/recruiting/candidates/merge  body: { survivorId, duplicateId, note? }
// Merge a duplicate candidate into the survivor (permissioned + audited).
export async function POST(request: Request) {
  const ctx = await appContext();
  return run(async () => {
    const body = await parseBody(request, MergeSchema);
    return mergeCandidates(ctx, body);
  });
}
