"use client";

// Phase 10 — audit integrity client root. Runs an integrity verification (POST
// verify) and shows the result (ok/failed, events checked, reason), plus the
// history of prior integrity checks (GET integrity-checks).

import { useState } from "react";
import { useAuditIntegrity } from "@/components/lawrence/hooks/useAuditIntegrity";
import { useSecurityActions } from "@/components/lawrence/hooks/useSecurityActions";
import { PageHeader } from "@/components/lawrence/shared/widgets";
import type { AuditVerifyResult } from "@/components/lawrence/hooks/securityTypes";

export function AuditIntegrityPage() {
  const { data, loading, error, refresh } = useAuditIntegrity();
  const actions = useSecurityActions(refresh);

  const [result, setResult] = useState<AuditVerifyResult | null>(null);
  const [verifyErr, setVerifyErr] = useState<string | null>(null);

  const verify = async () => {
    setVerifyErr(null);
    setResult(null);
    const res = await actions.post<AuditVerifyResult>("/api/security/audit/verify", {});
    if (res.ok && res.data) setResult(res.data);
    else setVerifyErr(res.error ?? "Verification failed.");
  };

  return (
    <>
      <PageHeader
        title="Audit integrity"
        sub="Verify the audit log hash chain and review the verification history."
      />

      <div className="card">
        <div className="row">
          <strong>Verify</strong>
          <button
            type="button"
            className="btn"
            disabled={actions.pending}
            onClick={verify}
          >
            Verify now
          </button>
        </div>
        {verifyErr ? (
          <p className="badge bad" style={{ marginTop: 8 }}>
            {verifyErr}
          </p>
        ) : null}
        {result ? (
          <div style={{ marginTop: 8 }}>
            <span className={`badge ${result.result.ok ? "good" : "bad"}`}>
              {result.result.ok ? "Integrity OK" : "Integrity failed"}
            </span>
            <p className="muted" style={{ marginTop: 8 }}>
              {result.result.eventsChecked} event(s) checked
              {result.result.reason ? ` — ${result.result.reason}` : ""}
              {result.result.failureEventId
                ? ` (failure at ${result.result.failureEventId})`
                : ""}
            </p>
          </div>
        ) : null}
      </div>

      <div className="card">
        <div className="row">
          <strong>Integrity check history</strong>
          <button type="button" className="btn" onClick={refresh} disabled={loading}>
            Refresh
          </button>
        </div>
        {error ? <p className="badge bad" style={{ marginTop: 8 }}>{error}</p> : null}
        {loading && !data ? (
          <div className="skeleton" style={{ height: 72, marginTop: 8 }} />
        ) : null}
        {data ? (
          data.length === 0 ? (
            <p className="muted" style={{ marginTop: 8 }}>
              No integrity checks recorded.
            </p>
          ) : (
            <table style={{ width: "100%", marginTop: 8 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Status</th>
                  <th style={{ textAlign: "left" }}>Range</th>
                  <th style={{ textAlign: "left" }}>Failure event</th>
                  <th style={{ textAlign: "left" }}>Checked at</th>
                </tr>
              </thead>
              <tbody>
                {data.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span className={`badge ${c.status === "passed" ? "good" : "bad"}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="muted">
                      {c.checkedFrom ? new Date(c.checkedFrom).toLocaleString() : "—"} →{" "}
                      {c.checkedTo ? new Date(c.checkedTo).toLocaleString() : "—"}
                    </td>
                    <td className="muted">{c.failureEventId ?? "—"}</td>
                    <td className="muted">{new Date(c.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : null}
      </div>
    </>
  );
}
