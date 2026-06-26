"use client";

// Phase 9 — inbound webhook endpoint panel. Shows the provider/connection
// webhook URL the external system should POST to, with a copy affordance and a
// note that the request must carry the signature header.

import { useState } from "react";
import type { IntegrationConnection } from "@/lib/integrations/integration-types";

export function WebhookEndpointPanel({ connection }: { connection: IntegrationConnection }) {
  const [copied, setCopied] = useState(false);

  const path = `/api/integrations/webhooks/${connection.provider}/${connection.key}`;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}${path}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="card">
      <strong>Inbound webhook</strong>
      <p className="muted" style={{ marginTop: 4 }}>
        Configure the provider to POST events to this URL:
      </p>
      <div className="row">
        <code style={{ wordBreak: "break-all" }}>{url}</code>
        <button type="button" className="btn" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="muted" style={{ marginTop: 8 }}>
        Requests must include the provider signature header — unsigned or
        invalid-signature events are rejected.
      </p>
    </div>
  );
}
