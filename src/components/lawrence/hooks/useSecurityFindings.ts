"use client";

// Phase 10 — security findings list hook. Fetches SecurityFinding[] with
// optional status/severity filters, aborting in-flight requests on
// unmount/refresh, and parses the { ok, data, error } envelope. Mirrors
// useObservabilityOverview.

import { useCallback, useEffect, useRef, useState } from "react";
import type { SecurityFinding } from "./securityTypes";

interface FindingsFilters {
  status?: string;
  severity?: string;
}

interface FindingsState {
  data: SecurityFinding[] | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useSecurityFindings(filters: FindingsFilters): FindingsState {
  const [data, setData] = useState<SecurityFinding[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  const { status, severity } = filters;

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (severity) params.set("severity", severity);
    const qs = params.toString();

    fetch(`/api/security/findings${qs ? `?${qs}` : ""}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as
          | { ok?: boolean; data?: SecurityFinding[]; error?: string }
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
  }, [nonce, status, severity]);

  return { data, loading, error, refresh };
}
