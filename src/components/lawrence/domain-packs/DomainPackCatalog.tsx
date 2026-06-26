"use client";

// Phase 8 — domain pack catalog client root. Loads the live catalog and renders
// a grid of DomainPackCard; shows skeletons while loading and an error card on
// failure. Install/uninstall actions refetch via the hook's refresh.

import { useDomainPackCatalog } from "@/components/lawrence/hooks/useDomainPackCatalog";
import { PageHeader } from "@/components/lawrence/shared/widgets";
import { DomainPackCard } from "./DomainPackCard";

function SkeletonCard() {
  return (
    <div className="card">
      <div className="skeleton" style={{ height: 18, width: "50%", marginBottom: 12 }} />
      <div className="skeleton" style={{ height: 48, marginBottom: 10 }} />
      <div className="skeleton" style={{ height: 32 }} />
    </div>
  );
}

export function DomainPackCatalog() {
  const { data, loading, error, refresh } = useDomainPackCatalog();

  return (
    <>
      <PageHeader
        title="Domain Packs"
        sub="Installable verticals — objects, workflows, agents, and demos."
      />

      {error ? (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="badge bad">Failed to load domain packs: {error}</p>
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
            <p className="muted">No domain packs available.</p>
          </div>
        ) : (
          <div className="cc-grid" style={{ marginTop: 16 }}>
            {data.map((entry) => (
              <div className="cc-col" key={entry.manifest.key}>
                <DomainPackCard entry={entry} onSettled={refresh} />
              </div>
            ))}
          </div>
        )
      ) : null}
    </>
  );
}
