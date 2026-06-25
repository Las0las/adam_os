import { NextResponse } from "next/server";
import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { summarize } from "@/lib/aiops/observability/trace-service";

// GET /api/aiops/observability/traces
export async function GET() {
  const ctx = await appContext();
  return NextResponse.json({
    summary: summarize(ctx),
    traces: db.modelTraces.list(ctx.tenantId).slice(-50),
  });
}
