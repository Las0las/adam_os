import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { run, parseBody } from "@/lib/app/route-helpers";
import { rejectRequest } from "@/lib/mission-control/approvals/approval-decision-service";

export const dynamic = "force-dynamic";

const DecisionSchema = z.object({ note: z.string().optional() });

// POST /api/mission-control/approvals/[approvalId]/reject  body: { note? }
export async function POST(request: Request, { params }: { params: { approvalId: string } }) {
  const ctx = await appContext();
  return run(async () => {
    const body = await parseBody(request, DecisionSchema);
    return rejectRequest(ctx, params.approvalId, body.note);
  });
}
