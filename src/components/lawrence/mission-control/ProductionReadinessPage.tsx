"use client";

// Phase 9 — production readiness dashboard client root. Loads the live
// ReadinessReport and lays out the score card, full checklist, and blockers list.

import { useReadiness } from "@/components/lawrence/hooks/useReadiness";
import { PageHeader } from "@/components/lawrence/shared/widgets";
import { ReadinessScoreCard } from "./ReadinessScoreCard";
import { ReadinessChecklist } from "./ReadinessChecklist";
import { ReadinessIssueList } from "./ReadinessIssueList";

export function ProductionReadinessPage() {
  const { data, loading, error, refresh } = useReadiness();

  return (
    <>
      <PageHeader title="Production readiness" sub="Live production-readiness score, checklist, and blockers." />

      <div className="card">
        <div className="row">
          <strong>Readiness report</strong>
          <button type="button" className="btn" onClick={refresh} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="card">
          <p className="badge bad">Failed to load readiness: {error}</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={refresh}>
              Try again
            </button>
          </div>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="card">
          <div className="skeleton" style={{ height: 72, marginBottom: 10 }} />
          <div className="skeleton" style={{ height: 72 }} />
        </div>
      ) : null}

      {data ? (
        <>
          <ReadinessScoreCard report={data} />
          <ReadinessIssueList blockers={data.blockers} />
          <ReadinessChecklist checks={data.checks} />
        </>
      ) : null}
    </>
  );
}
