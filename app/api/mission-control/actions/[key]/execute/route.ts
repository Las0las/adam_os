import { NextResponse } from "next/server";
import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { parseBody, errorResponse } from "@/lib/app/route-helpers";
import { executeAction } from "@/lib/mission-control/actions/action-service";

export const dynamic = "force-dynamic";

const ExecuteActionSchema = z.object({
  input: z.record(z.unknown()).optional(),
  object: z.object({ type: z.string(), id: z.string() }).optional(),
  idempotencyKey: z.string().optional(),
  approvalExempt: z.boolean().optional(),
  force: z.boolean().optional(),
});

// POST /api/mission-control/actions/:key/execute
// body: { input, object?, idempotencyKey?, approvalExempt?, force? }
export async function POST(
  request: Request,
  { params }: { params: { key: string } },
) {
  const ctx = await appContext();
  try {
    const body = await parseBody(request, ExecuteActionSchema);
    const exec = await executeAction(ctx, {
      actionKey: params.key,
      input: body.input ?? {},
      object: body.object,
      idempotencyKey: body.idempotencyKey,
      approvalExempt: body.approvalExempt,
      force: body.force,
    });
    return NextResponse.json(exec);
  } catch (err) {
    // ValidationError → 400, unknown action → 404, unexpected → redacted 500.
    return errorResponse(err);
  }
}
