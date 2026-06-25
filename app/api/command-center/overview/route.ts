import { NextResponse } from "next/server";
import { appContext } from "@/lib/app/demo-context";
import { getCommandCenterOverview } from "@/lib/domains/command-center/command-center-service";
import { isSurfaceMode } from "@/lib/domains/command-center/surface-mode";

export const dynamic = "force-dynamic";

// GET /api/command-center/overview?mode=recruiter|executive
export async function GET(request: Request) {
  const ctx = await appContext();
  const modeParam = new URL(request.url).searchParams.get("mode");
  const mode = isSurfaceMode(modeParam) ? modeParam : undefined;
  const data = await getCommandCenterOverview(ctx, { mode });
  return NextResponse.json({ ok: true, data });
}
