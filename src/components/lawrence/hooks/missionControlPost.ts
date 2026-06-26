"use client";

// Phase 6 — shared POST helper + mutation-runner for Mission Control action
// hooks. Parses the { ok, data, error } envelope and surfaces a consistent
// shape; the runner tracks { pending, error } and always calls onSettled.

import { useCallback, useState } from "react";

export interface Envelope<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export async function postJson<T = unknown>(
  url: string,
  body?: unknown,
): Promise<Envelope<T>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const parsed = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (parsed && typeof parsed.ok === "boolean") {
    if (!res.ok && parsed.error === undefined) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    return parsed;
  }
  return { ok: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` };
}

export interface MutationRunner {
  pending: boolean;
  error: string | null;
  run: (op: () => Promise<Envelope>) => Promise<Envelope>;
}

export function useMutationRunner(onSettled: () => void): MutationRunner {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (op: () => Promise<Envelope>): Promise<Envelope> => {
      setPending(true);
      setError(null);
      try {
        const result = await op();
        if (!result.ok) setError(result.error ?? "Request failed");
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        return { ok: false, error: message };
      } finally {
        setPending(false);
        onSettled();
      }
    },
    [onSettled],
  );

  return { pending, error, run };
}
