import { systemContext } from "@/lib/app/demo-context";
import { run, readJson } from "@/lib/app/route-helpers";
import { ingestWebhook } from "@/lib/integrations/webhook-ingest-service";
import type { IntegrationProvider } from "@/lib/integrations/integration-types";

export const dynamic = "force-dynamic";

// POST /api/integrations/webhooks/[provider]/[connectionKey]
// Machine endpoint: authenticated by webhook signature, not a user session.
export async function POST(request: Request, { params }: { params: { provider: string; connectionKey: string } }) {
  const ctx = await systemContext();
  const body = await readJson<{ eventType?: string; externalEventId?: string; payload?: Record<string, unknown> }>(request);
  const signature = request.headers.get("x-webhook-signature");
  return run(() =>
    ingestWebhook(ctx, {
      provider: params.provider as IntegrationProvider,
      connectionKey: params.connectionKey,
      eventType: body.eventType ?? "event",
      externalEventId: body.externalEventId ?? null,
      payload: body.payload ?? {},
      signature,
    }),
  );
}
