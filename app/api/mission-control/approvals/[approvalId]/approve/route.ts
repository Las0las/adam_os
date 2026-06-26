import { appContext } from "@/lib/app/demo-context";
import { run, readJson } from "@/lib/app/route-helpers";
import { approveRequest } from "@/lib/mission-control/approvals/approval-decision-service";

export const dynamic = "force-dynamic";

// POST /api/mission-control/approvals/[approvalId]/approve  body: { note? }
export async function POST(request: Request, { params }: { params: { approvalId: string } }) {
  const ctx = await appContext();
  const body = await readJson<{ note?: string }>(request);
  return run(() => approveRequest(ctx, params.approvalId, body.note));
}
