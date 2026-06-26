"use client";

// Phase 7 — run-eval button. POSTs the suite run via useRunEval and disables
// itself while pending. Surfaces any error inline. onSettled refetches upstream.

import { useRunEval } from "@/components/lawrence/hooks/useRunEval";

export function RunEvalButton({
  evalSuiteId,
  onSettled,
  label = "Run suite",
}: {
  evalSuiteId: string;
  onSettled: () => void;
  label?: string;
}) {
  const { pending, error, runEval } = useRunEval(onSettled);

  return (
    <span>
      <button
        type="button"
        className="btn"
        disabled={pending}
        onClick={() => {
          void runEval(evalSuiteId);
        }}
      >
        {pending ? "Running…" : label}
      </button>
      {error ? <span className="badge bad" style={{ marginLeft: 8 }}>{error}</span> : null}
    </span>
  );
}
