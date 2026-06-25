"use client";

// Phase 5 — Command Center overview hook (Part L). Fetches the operating
// surface snapshot for a surface mode, aborting in-flight requests on unmount
// and mode change. Returns the normalized overview plus loading/error/refresh.

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CommandCenterOverview,
  SurfaceMode,
} from "@/lib/domains/command-center/command-center-types";

interface OverviewState {
  data: CommandCenterOverview | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useCommandCenterOverview(mode: SurfaceMode): OverviewState {
  const [data, setData] = useState<CommandCenterOverview | null>(null);
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

    fetch(`/api/command-center/overview?mode=${encodeURIComponent(mode)}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as
          | { ok?: boolean; data?: CommandCenterOverview; error?: string }
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
  }, [mode, nonce]);

  return { data, loading, error, refresh };
}
