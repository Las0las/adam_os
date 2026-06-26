"use client";

// Phase 10 — security findings client root. Loads findings with status/severity
// filters and wires per-finding resolve / accept-risk mutations, refetching the
// list on settle.

import { useState } from "react";
import { useSecurityFindings } from "@/components/lawrence/hooks/useSecurityFindings";
import { useSecurityActions } from "@/components/lawrence/hooks/useSecurityActions";
import { PageHeader } from "@/components/lawrence/shared/widgets";
import { SecurityFindingsTable } from "./SecurityFindingsTable";

const STATUSES = ["", "open", "in_review", "resolved", "accepted_risk"] as const;
const SEVERITIES = ["", "low", "medium", "high", "critical"] as const;

export function SecurityFindingsPage() {
  const [status, setStatus] = useState<string>("open");
  const [severity, setSeverity] = useState<string>("");

  const { data, loading, error, refresh } = useSecurityFindings({
    status: status || undefined,
    severity: severity || undefined,
  });
  const actions = useSecurityActions(refresh);

  const handleResolve = (
    findingId: string,
    nextStatus: "resolved" | "accepted_risk" | "in_review",
  ) => {
    void actions.post(
      `/api/security/findings/${encodeURIComponent(findingId)}/resolve`,
      { status: nextStatus },
    );
  };

  return (
    <>
      <PageHeader
        title="Security findings"
        sub="Review, resolve, and accept-risk on open security findings."
      />

      <div className="card">
        <div className="btn-row">
          <label className="kv">
            <span className="muted">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s || "all"} value={s}>
                  {s || "all"}
                </option>
              ))}
            </select>
          </label>
          <label className="kv">
            <span className="muted">Severity</span>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
              {SEVERITIES.map((s) => (
                <option key={s || "all"} value={s}>
                  {s || "all"}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn" onClick={refresh} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {actions.error ? (
        <div className="card">
          <p className="badge bad">Action failed: {actions.error}</p>
        </div>
      ) : null}

      {error ? (
        <div className="card">
          <p className="badge bad">Failed to load findings: {error}</p>
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
        <SecurityFindingsTable
          findings={data}
          pending={actions.pending}
          onResolve={handleResolve}
        />
      ) : null}
    </>
  );
}
