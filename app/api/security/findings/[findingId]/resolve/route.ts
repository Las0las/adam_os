import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { run, parseBody } from "@/lib/app/route-helpers";
import { resolveFinding } from "@/lib/security/security-finding-service";

export const dynamic = "force-dynamic";

const ResolveFindingSchema = z.object({
  status: z.enum(["resolved", "accepted_risk", "in_review"]).optional(),
});

// POST /api/security/findings/:findingId/resolve  body: { status? }
export async function POST(request: Request, { params }: { params: { findingId: string } }) {
  const ctx = await appContext();
  return run(async () => {
    const body = await parseBody(request, ResolveFindingSchema);
    return resolveFinding(ctx, params.findingId, body.status ?? "resolved");
  });
}
