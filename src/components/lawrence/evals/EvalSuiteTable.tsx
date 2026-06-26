"use client";

// Phase 7 — eval suite table root. Fetches /api/aiops/evals, lists each suite
// with its type/target/status, a per-suite RunEvalButton (refetches on settle),
// and a link to the suite detail page. Skeleton + error card.

import Link from "next/link";
import { useEvalSuites } from "@/components/lawrence/hooks/useEvalSuites";
import { PageHeader, StatusBadge } from "@/components/lawrence/shared/widgets";
import { RunEvalButton } from "./RunEvalButton";

export function EvalSuiteTable() {
  const { data, loading, error, refresh } = useEvalSuites();

  return (
    <>
      <PageHeader
        title="Evals"
        sub="Productionized eval suites with baseline regression detection."
      />

      {error ? (
        <div className="card">
          <p className="badge bad">Failed to load suites: {error}</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={refresh}>
              Try again
            </button>
          </div>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="card">
          <div className="skeleton" style={{ height: 18, width: "40%", marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 72 }} />
        </div>
      ) : null}

      {data ? (
        <div className="card">
          {data.length === 0 ? (
            <p className="muted">No eval suites defined.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Target</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/aiops/evals/${encodeURIComponent(s.id)}`}>
                        {s.name}
                      </Link>
                    </td>
                    <td>
                      <span className="badge neutral">{s.suiteType}</span>
                    </td>
                    <td>
                      <code>
                        {s.targetComponentType ?? "—"}
                        {s.targetComponentKey ? `:${s.targetComponentKey}` : ""}
                      </code>
                    </td>
                    <td>
                      <StatusBadge status={s.status} />
                    </td>
                    <td>
                      <RunEvalButton evalSuiteId={s.id} onSettled={refresh} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </>
  );
}
