"use client";

// Phase 10 — compliance exports client root. Lists exports (GET), creates a new
// export via a type dropdown (POST), and loads a selected export's bundle (GET
// :id) into a <pre> viewer. full_evidence may 403 — surfaced gracefully.

import { useState } from "react";
import { useComplianceExports } from "@/components/lawrence/hooks/useComplianceExports";
import { useSecurityActions } from "@/components/lawrence/hooks/useSecurityActions";
import { PageHeader } from "@/components/lawrence/shared/widgets";
import type {
  ComplianceExportBundle,
  ComplianceExportType,
} from "@/components/lawrence/hooks/securityTypes";

const EXPORT_TYPES: ComplianceExportType[] = [
  "audit",
  "access",
  "data_map",
  "ai_usage",
  "retention",
  "security",
  "full_evidence",
];

export function CompliancePage() {
  const { data, loading, error, refresh } = useComplianceExports();
  const actions = useSecurityActions(refresh);

  const [exportType, setExportType] = useState<ComplianceExportType>("audit");
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  const [bundle, setBundle] = useState<ComplianceExportBundle | null>(null);
  const [bundleErr, setBundleErr] = useState<string | null>(null);
  const [bundleLoading, setBundleLoading] = useState(false);

  const submitCreate = async () => {
    setCreateMsg(null);
    const res = await actions.post("/api/security/compliance/exports", { exportType });
    setCreateMsg(res.ok ? "Export requested." : res.error ?? "Failed to request export.");
  };

  const loadBundle = async (exportId: string) => {
    setBundle(null);
    setBundleErr(null);
    setBundleLoading(true);
    try {
      const res = await fetch(
        `/api/security/compliance/exports/${encodeURIComponent(exportId)}`,
        { headers: { accept: "application/json" } },
      );
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; data?: ComplianceExportBundle; error?: string }
        | null;
      if (!res.ok || !body?.ok || !body.data) {
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setBundle(body.data);
    } catch (err) {
      setBundleErr(err instanceof Error ? err.message : String(err));
    } finally {
      setBundleLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Compliance exports"
        sub="Request evidence bundles and inspect prior exports."
      />

      <div className="card">
        <strong>Request export</strong>
        <div className="btn-row">
          <select
            value={exportType}
            onChange={(e) => setExportType(e.target.value as ComplianceExportType)}
          >
            {EXPORT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn"
            disabled={actions.pending}
            onClick={submitCreate}
          >
            Request export
          </button>
        </div>
        {createMsg ? (
          <p className="badge" style={{ marginTop: 8 }}>
            {createMsg}
          </p>
        ) : null}
      </div>

      <div className="card">
        <div className="row">
          <strong>Exports</strong>
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
              No exports yet.
            </p>
          ) : (
            <table style={{ width: "100%", marginTop: 8 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Type</th>
                  <th style={{ textAlign: "left" }}>Status</th>
                  <th style={{ textAlign: "left" }}>Created</th>
                  <th style={{ textAlign: "left" }} />
                </tr>
              </thead>
              <tbody>
                {data.map((e) => (
                  <tr key={e.id}>
                    <td>{e.exportType}</td>
                    <td>
                      <span
                        className={`badge ${e.status === "failed" ? "bad" : e.status === "completed" ? "good" : "warn"}`}
                      >
                        {e.status}
                      </span>
                    </td>
                    <td className="muted">{new Date(e.createdAt).toLocaleString()}</td>
                    <td>
                      <button
                        type="button"
                        className="btn"
                        disabled={bundleLoading}
                        onClick={() => loadBundle(e.id)}
                      >
                        View bundle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : null}
      </div>

      {bundleErr ? (
        <div className="card">
          <p className="badge bad">Could not load bundle: {bundleErr}</p>
        </div>
      ) : null}

      {bundleLoading ? (
        <div className="card">
          <div className="skeleton" style={{ height: 120 }} />
        </div>
      ) : null}

      {bundle ? (
        <div className="card">
          <strong>Bundle — {bundle.export.exportType}</strong>
          <pre style={{ marginTop: 8, maxHeight: 420, overflow: "auto", fontSize: 12 }}>
            {JSON.stringify(bundle.bundle, null, 2)}
          </pre>
        </div>
      ) : null}
    </>
  );
}
