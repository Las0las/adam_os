import { NextResponse } from "next/server";
import { appContext } from "@/lib/app/demo-context";
import { runFunction } from "@/lib/aiops/functions/function-runner";

export const dynamic = "force-dynamic";
// Side-effect import: registers the support.answer_with_citations handler.
import "@/lib/domains/support/support-functions";

// POST /api/support/answer-ticket  body: { ticketId, query? }
export async function POST(request: Request) {
  const ctx = await appContext();
  const body = (await request.json().catch(() => ({}))) as {
    ticketId?: string;
    query?: string;
  };
  if (!body.ticketId) {
    return NextResponse.json({ error: "missing ticketId" }, { status: 400 });
  }
  const run = await runFunction(ctx, "support.answer_with_citations", {
    ticketId: body.ticketId,
    query: body.query,
  });
  return NextResponse.json(run, { status: run.status === "failed" ? 422 : 200 });
}
