import { NextResponse } from "next/server";
import { appContext } from "@/lib/app/demo-context";
import { runFunction } from "@/lib/aiops/functions/function-runner";

export const dynamic = "force-dynamic";

// POST /api/aiops/functions/:key/run  body: { input: {...} }
export async function POST(
  request: Request,
  { params }: { params: { key: string } },
) {
  const ctx = await appContext();
  const body = (await request.json().catch(() => ({}))) as { input?: Record<string, unknown> };
  const run = await runFunction(ctx, params.key, body.input ?? {});
  return NextResponse.json(run, { status: run.status === "failed" ? 422 : 200 });
}
