import { NextResponse } from "next/server";
import { appContext } from "@/lib/app/demo-context";
import { rollbackRelease } from "@/lib/mission-control/runtime/deployment-service";

// POST /api/mission-control/releases/rollback
// body: { releaseId }
export async function POST(request: Request) {
  const ctx = await appContext();
  const body = (await request.json().catch(() => ({}))) as { releaseId: string };
  if (!body.releaseId) {
    return NextResponse.json({ error: "missing releaseId" }, { status: 400 });
  }
  const release = await rollbackRelease(ctx, body.releaseId);
  return NextResponse.json(release);
}
