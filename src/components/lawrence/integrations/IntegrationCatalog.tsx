"use client";

// Phase 9 — integration catalog client root. Lists the available provider
// catalog alongside the tenant's existing connections, and links out to create a
// new connection. Status badges reflect live connection status; no secrets are
// ever rendered.

import type { IntegrationProvider } from "@/lib/integrations/integration-types";
import { useIntegrations } from "@/components/lawrence/hooks/useIntegrations";
import { PageHeader } from "@/components/lawrence/shared/widgets";
import { IntegrationConnectionCard } from "./IntegrationConnectionCard";

const PROVIDER_CATALOG: Array<{ provider: IntegrationProvider; label: string }> = [
  { provider: "microsoft365", label: "Microsoft 365" },
  { provider: "google_workspace", label: "Google Workspace" },
  { provider: "slack", label: "Slack" },
  { provider: "sharepoint", label: "SharePoint" },
  { provider: "one_drive", label: "OneDrive" },
  { provider: "greenhouse", label: "Greenhouse" },
  { provider: "lever", label: "Lever" },
  { provider: "gusto", label: "Gusto" },
  { provider: "custom_api", label: "Custom API" },
  { provider: "webhook", label: "Webhook" },
];

export function IntegrationCatalog() {
  const { data, loading, error, refresh } = useIntegrations();

  return (
    <>
      <PageHeader title="Integrations" sub="Connect enterprise systems and operate the connections." />

      <div className="card">
        <div className="row">
          <strong>Connections</strong>
          <div className="btn-row">
            <button type="button" className="btn" onClick={refresh} disabled={loading}>
              Refresh
            </button>
            <a className="btn" href="/settings/integrations/new">
              New connection
            </a>
          </div>
        </div>
      </div>

      {error ? (
        <div className="card">
          <p className="badge bad">Failed to load integrations: {error}</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={refresh}>
              Try again
            </button>
          </div>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="card">
          <div className="skeleton" style={{ height: 72, marginBottom: 10 }} />
          <div className="skeleton" style={{ height: 72 }} />
        </div>
      ) : null}

      {data ? (
        data.length === 0 ? (
          <div className="card">
            <p className="muted">No connections yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="cc-grid">
            {data.map((connection) => (
              <IntegrationConnectionCard key={connection.id} connection={connection} />
            ))}
          </div>
        )
      ) : null}

      <div className="card">
        <strong>Provider catalog</strong>
        <p className="muted" style={{ marginTop: 4 }}>
          Supported providers. Create a connection and supply a credential reference
          to activate one.
        </p>
        <div className="cc-grid" style={{ marginTop: 8 }}>
          {PROVIDER_CATALOG.map((p) => (
            <a
              key={p.provider}
              className="card"
              href={`/settings/integrations/new?provider=${p.provider}`}
              style={{ display: "block" }}
            >
              <strong>{p.label}</strong>
              <p className="muted">{p.provider}</p>
            </a>
          ))}
        </div>
      </div>
    </>
  );
}
