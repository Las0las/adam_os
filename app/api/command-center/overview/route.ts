import { NextResponse } from "next/server";
import { appContext } from "@/lib/app/demo-context";
import { getCommandCenterOverview } from "@/lib/domains/command-center/command-center-service";
import { isSurfaceMode } from "@/lib/domains/command-center/surface-mode";

export const dynamic = "force-dynamic";

// GET /api/command-center/overview?mode=recruiter|executive&demoMode=true&packKey=
export async function GET(request: Request) {
  const ctx = await appContext();
  const params = new URL(request.url).searchParams;
  const modeParam = params.get("mode");
  const mode = isSurfaceMode(modeParam) ? modeParam : undefined;
  const demoMode = params.get("demoMode") === "true";
  const packKey = params.get("packKey") ?? undefined;
  const data = await getCommandCenterOverview(ctx, { mode, demoMode, packKey });
  return NextResponse.json({ ok: true, data });
}
