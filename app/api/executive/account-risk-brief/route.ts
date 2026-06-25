import { NextResponse } from "next/server";
import { appContext } from "@/lib/app/demo-context";
import { runFunction } from "@/lib/aiops/functions/function-runner";
import "@/lib/domains/executive/executive-seed-pack";

export const dynamic = "force-dynamic";

// POST /api/executive/account-risk-brief  body: { accountId }
export async function POST(request: Request) {
  const ctx = await appContext();
  const body = (await request.json().catch(() => ({}))) as { accountId?: string };
  if (!body.accountId) {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }
  const run = await runFunction(ctx, "executive.account_risk_brief", {
    accountId: body.accountId,
  });
  return NextResponse.json(run, { status: run.status === "failed" ? 422 : 200 });
}
