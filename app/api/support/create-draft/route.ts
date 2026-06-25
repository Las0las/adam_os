import { NextResponse } from "next/server";
import { appContext } from "@/lib/app/demo-context";
import { runTicketResponseWorkflow } from "@/lib/domains/support/support-workflow-service";
// Side-effect import: registers the support function + draft action handlers.
import "@/lib/domains/support/support-functions";
import "@/lib/domains/support/support-actions";

// POST /api/support/create-draft  body: { ticketId, query?, assigneeUserId? }
export async function POST(request: Request) {
  const ctx = await appContext();
  const body = (await request.json().catch(() => ({}))) as {
    ticketId?: string;
    query?: string;
    assigneeUserId?: string;
  };
  if (!body.ticketId) {
    return NextResponse.json({ error: "missing ticketId" }, { status: 400 });
  }
  const result = await runTicketResponseWorkflow(ctx, {
    ticketId: body.ticketId,
    query: body.query,
    assigneeUserId: body.assigneeUserId,
  });
  return NextResponse.json(result);
}
