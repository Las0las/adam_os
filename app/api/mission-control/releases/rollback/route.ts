import { NextResponse } from "next/server";
import { z } from "zod";
import { appContext } from "@/lib/app/demo-context";
import { parseBody, ValidationError } from "@/lib/app/route-helpers";
import { rollbackRelease } from "@/lib/mission-control/runtime/deployment-service";

export const dynamic = "force-dynamic";

const RollbackSchema = z.object({ releaseId: z.string().min(1) });

// POST /api/mission-control/releases/rollback
// body: { releaseId }
export async function POST(request: Request) {
  const ctx = await appContext();
  let releaseId: string;
  try {
    ({ releaseId } = await parseBody(request, RollbackSchema));
  } catch (err) {
    const message = err instanceof ValidationError ? err.message : "missing releaseId";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const release = await rollbackRelease(ctx, releaseId);
  return NextResponse.json(release);
}
