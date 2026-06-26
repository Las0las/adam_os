"use client";

// Phase 8 — reset control for a demo. Confirms before resetting, then calls the
// runner's reset with removeTraces:true so demo objects + traces are cleared.

import { useDemoRunner } from "@/components/lawrence/hooks/useDemoRunner";

export function DemoResetButton({
  packKey,
  demoKey,
  onSettled,
}: {
  packKey: string;
  demoKey: string;
  onSettled: () => void;
}) {
  const { pending, error, reset } = useDemoRunner(onSettled);

  const handleReset = () => {
    const confirmed = window.confirm(
      "Reset this demo? Demo objects and run traces will be removed.",
    );
    if (!confirmed) return;
    void reset(packKey, demoKey, { removeTraces: true });
  };

  return (
    <div>
      <button
        type="button"
        className="btn"
        disabled={pending}
        onClick={handleReset}
      >
        {pending ? "Resetting…" : "Reset demo"}
      </button>
      {error ? (
        <p className="badge bad" style={{ marginTop: 8 }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
