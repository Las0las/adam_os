"use client";

// Phase 9 — integration health panel. Runs POST /api/integrations/[id]/test and
// shows the real IntegrationHealthResult (status badge + message + latency). A
// missing credential yields not_configured — this never fakes success.

import { useState } from "react";
import type { IntegrationHealthResult } from "@/lib/integrations/integration-types";
import { useIntegrationActions } from "@/components/lawrence/hooks/useIntegrationActions";
import { IntegrationStatusBadge } from "./IntegrationConnectionCard";

export function IntegrationHealthPanel({
  connectionId,
  onSettled,
}: {
  connectionId: string;
  onSettled: () => void;
}) {
  const [result, setResult] = useState<IntegrationHealthResult | null>(null);
  const { pending, error, test } = useIntegrationActions(onSettled);

  async function handleTest() {
    const res = await test(connectionId);
    if (res.ok && res.data) setResult(res.data);
  }

  return (
    <div className="card">
      <div className="row">
        <strong>Health</strong>
        <button type="button" className="btn" onClick={handleTest} disabled={pending}>
          {pending ? "Testing…" : "Test connection"}
        </button>
      </div>

      {error ? <p className="badge bad">{error}</p> : null}

      {result ? (
        <>
          <div className="row">
            <span className="muted">Status</span>
            <IntegrationStatusBadge status={result.status} />
          </div>
          <div className="row">
            <span className="muted">Message</span>
            <span>{result.message}</span>
          </div>
          {result.latencyMs !== undefined ? (
            <div className="row">
              <span className="muted">Latency</span>
              <span>{result.latencyMs} ms</span>
            </div>
          ) : null}
        </>
      ) : (
        <p className="muted">Run a test to check this connection's health.</p>
      )}
    </div>
  );
}
