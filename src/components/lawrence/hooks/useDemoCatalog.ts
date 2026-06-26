"use client";

// Phase 8 — demo scenario catalog hook. GET /api/demos → DemoScenario[], or
// GET /api/demos/[packKey] when a packKey is supplied. Aborts in-flight
// requests, parses the { ok, data, error } envelope, supports refresh.

import { useCallback, useEffect, useRef, useState } from "react";
import type { DemoScenario } from "@/lib/domain-packs/domain-pack-types";

interface DemoCatalogState {
  data: DemoScenario[] | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useDemoCatalog(packKey?: string): DemoCatalogState {
  const [data, setData] = useState<DemoScenario[] | null>(null);
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

    const url = packKey
      ? `/api/demos/${encodeURIComponent(packKey)}`
      : "/api/demos";

    fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as
          | { ok?: boolean; data?: DemoScenario[]; error?: string }
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
  }, [packKey, nonce]);

  return { data, loading, error, refresh };
}
