import { NextResponse } from "next/server";
import { appContext } from "@/lib/app/demo-context";
import { promoteRelease } from "@/lib/mission-control/runtime/deployment-service";

export const dynamic = "force-dynamic";

// POST /api/mission-control/deployments/promote
// body: { releaseId }
export async function POST(request: Request) {
  const ctx = await appContext();
  const body = (await request.json().catch(() => ({}))) as { releaseId: string };
  if (!body.releaseId) {
    return NextResponse.json({ error: "missing releaseId" }, { status: 400 });
  }
  const release = await promoteRelease(ctx, body.releaseId);
  return NextResponse.json(release);
}
