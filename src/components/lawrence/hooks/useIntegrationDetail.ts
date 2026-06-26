"use client";

// Phase 9 — integration connection detail hook. Fetches the connection
// (GET /api/integrations/[connectionId]) plus its sync runs
// (GET /api/integrations/[connectionId]/sync-runs) in parallel. Aborts
// in-flight requests, parses the { ok, data, error } envelope, supports refresh.

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  IntegrationConnection,
  IntegrationSyncRun,
} from "@/lib/integrations/integration-types";

export interface IntegrationDetailData {
  connection: IntegrationConnection;
  syncRuns: IntegrationSyncRun[];
}

interface DetailState {
  data: IntegrationDetailData | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

async function fetchEnvelope<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, headers: { accept: "application/json" } });
  const body = (await res.json().catch(() => null)) as
    | { ok?: boolean; data?: T; error?: string }
    | null;
  if (!res.ok || !body?.ok || body.data === undefined) {
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  return body.data;
}

export function useIntegrationDetail(connectionId: string): DetailState {
  const [data, setData] = useState<IntegrationDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    Promise.all([
      fetchEnvelope<IntegrationConnection>(
        `/api/integrations/${encodeURIComponent(connectionId)}`,
        controller.signal,
      ),
      fetchEnvelope<IntegrationSyncRun[]>(
        `/api/integrations/${encodeURIComponent(connectionId)}/sync-runs`,
        controller.signal,
      ),
    ])
      .then(([connection, syncRuns]) => {
        if (controller.signal.aborted) return;
        setData({ connection, syncRuns });
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => controller.abort();
  }, [connectionId, nonce]);

  return { data, loading, error, refresh };
}
