"use client";

// Phase 10 — retention client root. Lists retention policies (with a per-policy
// Run action + dry-run toggle), a create-policy form, and the jobs history.
// Mutations refetch both policies and jobs on settle.

import { useState } from "react";
import { useRetention } from "@/components/lawrence/hooks/useRetention";
import { useSecurityActions } from "@/components/lawrence/hooks/useSecurityActions";
import { PageHeader } from "@/components/lawrence/shared/widgets";
import type { RetentionAction } from "@/components/lawrence/hooks/securityTypes";

const ACTIONS: RetentionAction[] = ["archive", "redact", "delete", "review"];

export function RetentionPage() {
  const { data, loading, error, refresh } = useRetention();
  const actions = useSecurityActions(refresh);

  const [dryRun, setDryRun] = useState(true);

  // Create policy form state.
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [objectType, setObjectType] = useState("");
  const [retentionDays, setRetentionDays] = useState("90");
  const [action, setAction] = useState<RetentionAction>("archive");
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  const submitCreate = async () => {
    setCreateMsg(null);
    const res = await actions.post("/api/security/retention/policies", {
      key: key.trim(),
      name: name.trim(),
      objectType: objectType.trim(),
      retentionDays: Number(retentionDays) || 0,
      action,
    });
    if (res.ok) {
      setCreateMsg("Policy created.");
      setKey("");
      setName("");
      setObjectType("");
    } else {
      setCreateMsg(res.error ?? "Failed to create policy.");
    }
  };

  const runPolicy = (policyId: string) => {
    void actions.post("/api/security/retention/run", { policyId, dryRun });
  };

  return (
    <>
      <PageHeader
        title="Retention"
        sub="Manage retention policies and run retention jobs."
      />

      <div className="card">
        <div className="row">
          <strong>Policies</strong>
          <div className="btn-row">
            <label className="row" style={{ gap: 6 }}>
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
              />
              <span className="muted">Dry run</span>
            </label>
            <button type="button" className="btn" onClick={refresh} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>

        {error ? <p className="badge bad" style={{ marginTop: 8 }}>{error}</p> : null}
        {actions.error ? (
          <p className="badge bad" style={{ marginTop: 8 }}>
            Action failed: {actions.error}
          </p>
        ) : null}

        {loading && !data ? (
          <div className="skeleton" style={{ height: 72, marginTop: 8 }} />
        ) : null}

        {data ? (
          data.policies.length === 0 ? (
            <p className="muted" style={{ marginTop: 8 }}>
              No retention policies.
            </p>
          ) : (
            <table style={{ width: "100%", marginTop: 8 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Name</th>
                  <th style={{ textAlign: "left" }}>Object type</th>
                  <th style={{ textAlign: "left" }}>Days</th>
                  <th style={{ textAlign: "left" }}>Action</th>
                  <th style={{ textAlign: "left" }}>Status</th>
                  <th style={{ textAlign: "left" }} />
                </tr>
              </thead>
              <tbody>
                {data.policies.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.name}
                      <div className="muted" style={{ fontSize: 12 }}>
                        {p.key}
                      </div>
                    </td>
                    <td className="muted">{p.objectType}</td>
                    <td>{p.retentionDays}</td>
                    <td>
                      <span className="badge">{p.action}</span>
                    </td>
                    <td className="muted">{p.status}</td>
                    <td>
                      <button
                        type="button"
                        className="btn"
                        disabled={actions.pending}
                        onClick={() => runPolicy(p.id)}
                      >
                        Run{dryRun ? " (dry)" : ""}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : null}
      </div>

      <div className="card">
        <strong>Create policy</strong>
        <label className="kv">
          <span className="muted">Key</span>
          <input value={key} onChange={(e) => setKey(e.target.value)} />
        </label>
        <label className="kv">
          <span className="muted">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="kv">
          <span className="muted">Object type</span>
          <input value={objectType} onChange={(e) => setObjectType(e.target.value)} />
        </label>
        <label className="kv">
          <span className="muted">Retention days</span>
          <input
            type="number"
            value={retentionDays}
            onChange={(e) => setRetentionDays(e.target.value)}
          />
        </label>
        <label className="kv">
          <span className="muted">Action</span>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value as RetentionAction)}
          >
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <div className="btn-row">
          <button
            type="button"
            className="btn"
            disabled={
              actions.pending || !key.trim() || !name.trim() || !objectType.trim()
            }
            onClick={submitCreate}
          >
            Create policy
          </button>
        </div>
        {createMsg ? (
          <p className="badge" style={{ marginTop: 8 }}>
            {createMsg}
          </p>
        ) : null}
      </div>

      <div className="card">
        <strong>Jobs</strong>
        {data ? (
          data.jobs.length === 0 ? (
            <p className="muted" style={{ marginTop: 8 }}>
              No retention jobs.
            </p>
          ) : (
            <table style={{ width: "100%", marginTop: 8 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Job</th>
                  <th style={{ textAlign: "left" }}>Status</th>
                  <th style={{ textAlign: "left" }}>Affected</th>
                  <th style={{ textAlign: "left" }}>Created</th>
                </tr>
              </thead>
              <tbody>
                {data.jobs.map((j) => (
                  <tr key={j.id}>
                    <td className="muted">{j.id}</td>
                    <td>
                      <span
                        className={`badge ${j.status === "failed" ? "bad" : j.status === "completed" ? "good" : "warn"}`}
                      >
                        {j.status}
                      </span>
                    </td>
                    <td>{j.affectedCount}</td>
                    <td className="muted">{new Date(j.createdAt).toLocaleString()}</td>
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
