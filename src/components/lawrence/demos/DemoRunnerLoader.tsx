"use client";

// Phase 8 — client loader for the demo runner page. Fetches the pack's demo
// scenarios (GET /api/demos/[packKey]), finds the one matching demoKey, then
// renders the runner. Handles loading/error/not-found states.

import { useDemoCatalog } from "@/components/lawrence/hooks/useDemoCatalog";
import { PageHeader } from "@/components/lawrence/shared/widgets";
import { DemoRunnerPage } from "./DemoRunnerPage";

export function DemoRunnerLoader({
  packKey,
  demoKey,
}: {
  packKey: string;
  demoKey: string;
}) {
  const { data, loading, error, refresh } = useDemoCatalog(packKey);

  if (error) {
    return (
      <>
        <PageHeader title="Demo" sub={`${packKey} / ${demoKey}`} />
        <div className="card" style={{ marginTop: 16 }}>
          <p className="badge bad">Failed to load demo: {error}</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={refresh}>
              Try again
            </button>
          </div>
        </div>
      </>
    );
  }

  if (loading && !data) {
    return (
      <>
        <PageHeader title="Demo" sub={`${packKey} / ${demoKey}`} />
        <div className="card" style={{ marginTop: 16 }}>
          <div className="skeleton" style={{ height: 18, width: "40%", marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 80 }} />
        </div>
      </>
    );
  }

  const scenario = data?.find((s) => s.key === demoKey);

  if (!scenario) {
    return (
      <>
        <PageHeader title="Demo" sub={`${packKey} / ${demoKey}`} />
        <div className="card" style={{ marginTop: 16 }}>
          <p className="muted">Demo scenario not found.</p>
          <p>
            <a href={`/demos/${encodeURIComponent(packKey)}`}>← Back to demos</a>
          </p>
        </div>
      </>
    );
  }

  return (
    <DemoRunnerPage packKey={packKey} demoKey={demoKey} scenario={scenario} />
  );
}
