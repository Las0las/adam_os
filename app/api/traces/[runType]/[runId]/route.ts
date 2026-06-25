import { NextResponse } from "next/server";
import { appContext } from "@/lib/app/demo-context";
import { getRunTrace } from "@/lib/domains/object-detail/object-detail-service";

export const dynamic = "force-dynamic";

// GET /api/traces/:runType/:runId
export async function GET(
  _request: Request,
  { params }: { params: { runType: string; runId: string } },
) {
  const ctx = await appContext();
  const runType = params.runType;
  if (runType !== "function" && runType !== "agent" && runType !== "action") {
    return NextResponse.json({ ok: false, error: `unknown run type: ${runType}` }, { status: 400 });
  }
  const data = await getRunTrace(ctx, runType, params.runId);
  if (!data) return NextResponse.json({ ok: false, error: "trace not found" }, { status: 404 });
  return NextResponse.json({ ok: true, data });
}
