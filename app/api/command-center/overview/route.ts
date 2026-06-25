import { NextResponse } from "next/server";
import { appContext } from "@/lib/app/demo-context";
import { getCommandCenterOverview } from "@/lib/domains/command-center/command-center-service";

// GET /api/command-center/overview — cross-domain aggregated work queue.
export async function GET() {
  const ctx = await appContext();
  return NextResponse.json(await getCommandCenterOverview(ctx));
}
