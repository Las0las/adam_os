"use client";

// Phase 9 — integration connections list hook. GET /api/integrations →
// IntegrationConnection[]. Aborts in-flight requests, parses the
// { ok, data, error } envelope, supports refresh.

import { useCallback, useEffect, useRef, useState } from "react";
import type { IntegrationConnection } from "@/lib/integrations/integration-types";

interface IntegrationsState {
  data: IntegrationConnection[] | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useIntegrations(): IntegrationsState {
  const [data, setData] = useState<IntegrationConnection[] | null>(null);
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

    fetch("/api/integrations", {
      signal: controller.signal,
      headers: { accept: "application/json" },
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as
          | { ok?: boolean; data?: IntegrationConnection[]; error?: string }
          | null;
        if (!res.ok || !body?.ok || !body.data) {
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        return body.data;
      })
      .then((next) => {
        if (controller.signal.aborted) return;
        setData(next);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => controller.abort();
  }, [nonce]);

  return { data, loading, error, refresh };
}
