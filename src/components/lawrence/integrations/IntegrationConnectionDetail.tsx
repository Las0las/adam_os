"use client";

// Phase 9 — integration connection detail client root. Loads the connection plus
// its sync runs, shows metadata (no secrets), and hosts the health panel, run-sync
// action, sync history, and inbound webhook panel. Every mutation refetches via
// the shared refresh.

import { useIntegrationDetail } from "@/components/lawrence/hooks/useIntegrationDetail";
import { PageHeader } from "@/components/lawrence/shared/widgets";
import { IntegrationStatusBadge } from "./IntegrationConnectionCard";
import { IntegrationHealthPanel } from "./IntegrationHealthPanel";
import { RunSyncButton } from "./RunSyncButton";
import { IntegrationSyncHistory } from "./IntegrationSyncHistory";
import { WebhookEndpointPanel } from "./WebhookEndpointPanel";

export function IntegrationConnectionDetail({ connectionId }: { connectionId: string }) {
  const { data, loading, error, refresh } = useIntegrationDetail(connectionId);

  return (
    <>
      <PageHeader title="Integration connection" sub="Enterprise connection detail and operations." />

      {error ? (
        <div className="card">
          <p className="badge bad">Failed to load connection: {error}</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={refresh}>
              Try again
            </button>
          </div>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="card">
          <div className="skeleton" style={{ height: 18, width: "40%", marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 72, marginBottom: 10 }} />
          <div className="skeleton" style={{ height: 72 }} />
        </div>
      ) : null}

      {data ? (
        <>
          <div className="card">
            <div className="row">
              <strong>{data.connection.name}</strong>
              <IntegrationStatusBadge status={data.connection.status} />
            </div>
            <div className="row">
              <span className="muted">Provider</span>
              <span>{data.connection.provider.replace(/_/g, " ")}</span>
            </div>
            <div className="row">
              <span className="muted">Key</span>
              <span>{data.connection.key}</span>
            </div>
            <div className="row">
              <span className="muted">Credential ref</span>
              <span>{data.connection.credentialRef ? data.connection.credentialRef : "not configured"}</span>
            </div>
            <div className="row">
              <span className="muted">Created</span>
              <span>{new Date(data.connection.createdAt).toLocaleString()}</span>
            </div>
            <div className="row">
              <span className="muted">Updated</span>
              <span>{new Date(data.connection.updatedAt).toLocaleString()}</span>
            </div>
          </div>

          <IntegrationHealthPanel connectionId={connectionId} onSettled={refresh} />
          <RunSyncButton connectionId={connectionId} onSettled={refresh} />
          <IntegrationSyncHistory runs={data.syncRuns} />
          <WebhookEndpointPanel connection={data.connection} />
        </>
      ) : null}
    </>
  );
}
