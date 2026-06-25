import { NextResponse } from "next/server";
import { appContext } from "@/lib/app/demo-context";
import { emitEvent } from "@/lib/mission-control/notifications/notification-service";

export const dynamic = "force-dynamic";

// POST /api/mission-control/notifications/test
// body: { eventKey, recipientUserId?, vars? }
export async function POST(request: Request) {
  const ctx = await appContext();
  const body = (await request.json().catch(() => ({}))) as {
    eventKey: string;
    recipientUserId?: string;
    vars?: Record<string, unknown>;
  };
  if (!body.eventKey) {
    return NextResponse.json({ error: "missing eventKey" }, { status: 400 });
  }
  const notifications = await emitEvent(
    ctx,
    body.eventKey,
    body.recipientUserId ?? ctx.actorUserId ?? "system",
    body.vars ?? {},
  );
  return NextResponse.json(notifications);
}
