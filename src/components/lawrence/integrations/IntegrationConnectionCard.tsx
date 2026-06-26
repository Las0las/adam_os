"use client";

// Phase 9 — integration connection summary card. Shows the connection name,
// provider, and a status-colored badge. NEVER renders a secret: only the
// masked credential reference NAME (env var / secret-manager key) is shown.

import type { IntegrationConnection, IntegrationStatus } from "@/lib/integrations/integration-types";

const STATUS_TONE: Record<IntegrationStatus, string> = {
  active: "good",
  not_configured: "neutral",
  degraded: "warn",
  disabled: "neutral",
  failed: "bad",
};

export function IntegrationStatusBadge({ status }: { status: IntegrationStatus }) {
  const tone = STATUS_TONE[status] ?? "neutral";
  return <span className={`badge ${tone}`}>{status.replace(/_/g, " ")}</span>;
}

export function IntegrationConnectionCard({ connection }: { connection: IntegrationConnection }) {
  return (
    <a className="card" href={`/settings/integrations/${connection.id}`} style={{ display: "block" }}>
      <div className="row">
        <strong>{connection.name}</strong>
        <IntegrationStatusBadge status={connection.status} />
      </div>
      <div className="row">
        <span className="muted">Provider</span>
        <span>{connection.provider.replace(/_/g, " ")}</span>
      </div>
      <div className="row">
        <span className="muted">Key</span>
        <span>{connection.key}</span>
      </div>
      <div className="row">
        <span className="muted">Credential ref</span>
        <span>{connection.credentialRef ? connection.credentialRef : "—"}</span>
      </div>
    </a>
  );
}
