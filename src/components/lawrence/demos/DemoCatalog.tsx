"use client";

// Phase 8 — demo catalog client root. Loads all demo scenarios (optionally
// scoped to a pack) and renders a grid of DemoScenarioCard; skeleton + error
// card.

import { useDemoCatalog } from "@/components/lawrence/hooks/useDemoCatalog";
import { PageHeader } from "@/components/lawrence/shared/widgets";
import { DemoScenarioCard } from "./DemoScenarioCard";

function SkeletonCard() {
  return (
    <div className="card">
      <div className="skeleton" style={{ height: 18, width: "50%", marginBottom: 12 }} />
      <div className="skeleton" style={{ height: 48 }} />
    </div>
  );
}

export function DemoCatalog({
  packKey,
  title,
  sub,
}: {
  packKey?: string;
  title?: string;
  sub?: string;
}) {
  const { data, loading, error, refresh } = useDemoCatalog(packKey);

  return (
    <>
      <PageHeader
        title={title ?? "Customer Demos"}
        sub={sub ?? "Guided, runnable scenarios that show real platform value."}
      />

      {error ? (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="badge bad">Failed to load demos: {error}</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={refresh}>
              Try again
            </button>
          </div>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="cc-grid" style={{ marginTop: 16 }}>
          <div className="cc-col">
            <SkeletonCard />
          </div>
          <div className="cc-col">
            <SkeletonCard />
          </div>
          <div className="cc-col">
            <SkeletonCard />
          </div>
        </div>
      ) : null}

      {data ? (
        data.length === 0 ? (
          <div className="card" style={{ marginTop: 16 }}>
            <p className="muted">No demo scenarios available.</p>
          </div>
        ) : (
          <div className="cc-grid" style={{ marginTop: 16 }}>
            {data.map((scenario) => (
              <div className="cc-col" key={`${scenario.packKey}:${scenario.key}`}>
                <DemoScenarioCard scenario={scenario} />
              </div>
            ))}
          </div>
        )
      ) : null}
    </>
  );
}
