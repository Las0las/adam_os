import { NextResponse } from "next/server";
import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { parseBody, errorResponse } from "@/lib/app/route-helpers";
import { rollbackRelease } from "@/lib/mission-control/runtime/deployment-service";

export const dynamic = "force-dynamic";

const RollbackSchema = z.object({ releaseId: z.string().min(1) });

// POST /api/mission-control/releases/rollback
// body: { releaseId }
export async function POST(request: Request) {
  const ctx = await appContext();
  try {
    const { releaseId } = await parseBody(request, RollbackSchema);
    const release = await rollbackRelease(ctx, releaseId);
    return NextResponse.json(release);
  } catch (err) {
    return errorResponse(err);
  }
}
