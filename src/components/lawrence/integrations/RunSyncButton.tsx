"use client";

// Phase 9 — run-sync action. POSTs /api/integrations/[id]/sync, then refetches
// the connection + sync history via onSettled.

import { useState } from "react";
import type { SyncType } from "@/lib/integrations/integration-types";
import { useIntegrationActions } from "@/components/lawrence/hooks/useIntegrationActions";

export function RunSyncButton({
  connectionId,
  onSettled,
}: {
  connectionId: string;
  onSettled: () => void;
}) {
  const [syncType, setSyncType] = useState<SyncType>("incremental");
  const { pending, error, sync } = useIntegrationActions(onSettled);

  return (
    <div className="card">
      <div className="row">
        <strong>Run sync</strong>
        <div className="btn-row">
          <select
            value={syncType}
            onChange={(e) => setSyncType(e.target.value as SyncType)}
            disabled={pending}
          >
            <option value="incremental">incremental</option>
            <option value="full">full</option>
          </select>
          <button
            type="button"
            className="btn"
            onClick={() => sync(connectionId, syncType)}
            disabled={pending}
          >
            {pending ? "Syncing…" : "Run sync"}
          </button>
        </div>
      </div>
      {error ? <p className="badge bad">{error}</p> : null}
    </div>
  );
}
