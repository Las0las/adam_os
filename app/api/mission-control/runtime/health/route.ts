import { NextResponse } from "next/server";
import { appContext } from "@/lib/app/demo-context";
import { runtimeHealth } from "@/lib/mission-control/runtime/deployment-service";

// GET /api/mission-control/runtime/health
export async function GET() {
  const ctx = await appContext();
  return NextResponse.json(await runtimeHealth(ctx));
}
