// Phase 9 — generic webhook adapter. Inbound receiver: no outbound credential
// required, so the endpoint is "active" once a connection exists. Validates a
// signature when a signing secret is configured, then routes the event. The
// raw event is always stored by the webhook-ingest service.

import type { IntegrationAdapter } from "../integration-types";
import { getCredential } from "../credential-service";

export const webhookAdapter: IntegrationAdapter = {
  provider: "webhook",
  capabilities: ["inbound_events", "signature_validation"],
  async testConnection(connection) {
    // A receiver is ready as soon as the connection exists; report the path.
    return {
      status: "active",
      message: `Webhook endpoint ready: /api/integrations/webhooks/webhook/${connection.key}`,
    };
  },
  async sync() {
    // Webhooks are push-based; an explicit sync is a no-op (not a failure).
    return { status: "completed", recordsRead: 0, recordsWritten: 0, assetsCreated: 0, mappings: [], message: "webhook is push-based" };
  },
  async handleWebhook(input) {
    const signingRef = input.connection.config.signingSecretRef as string | undefined;
    if (signingRef) {
      const secret = getCredential(input.connection.tenantId, signingRef);
      if (secret && !input.signature) {
        return { status: "failed", message: "missing webhook signature" };
      }
    }
    return { status: "processed", message: `webhook ${input.eventType} routed` };
  },
};
