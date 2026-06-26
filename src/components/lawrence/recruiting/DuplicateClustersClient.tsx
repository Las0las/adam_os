"use client";

// Review-gated candidate merge. Lists likely-duplicate clusters from the scan and
// lets a reviewer confirm each merge (or swap which record survives). Nothing
// merges without an explicit click; the merge itself is permissioned + audited
// server-side.

import { useCallback, useEffect, useState } from "react";

interface Cluster {
  survivorId: string;
  survivorTitle: string | null;
  duplicateId: string;
  duplicateTitle: string | null;
  reason: string;
  strength: "strong" | "medium" | "weak";
}

interface Row extends Cluster {
  flipped: boolean;
  busy: boolean;
  merged: boolean;
  error?: string;
}

function strengthBadge(s: Row["strength"]): string {
  return s === "strong" ? "badge ok" : "badge";
}

export function DuplicateClustersClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recruiting/candidates/duplicates");
      const json = (await res.json()) as { ok?: boolean; data?: Cluster[]; error?: string };
      if (!res.ok || json.ok === false) {
        setError(json.error ?? `Request failed (${res.status})`);
        return;
      }
      setRows((json.data ?? []).map((c) => ({ ...c, flipped: false, busy: false, merged: false })));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function update(idx: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  async function merge(idx: number) {
    const r = rows[idx];
    if (!r) return;
    const survivorId = r.flipped ? r.duplicateId : r.survivorId;
    const duplicateId = r.flipped ? r.survivorId : r.duplicateId;
    update(idx, { busy: true, error: undefined });
    try {
      const res = await fetch("/api/recruiting/candidates/merge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ survivorId, duplicateId }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) {
        update(idx, { busy: false, error: json.error ?? `Merge failed (${res.status})` });
        return;
      }
      update(idx, { busy: false, merged: true });
    } catch (e) {
      update(idx, { busy: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <>
      <h1 className="page-title">Duplicate candidates</h1>
      <p className="muted">
        Likely-duplicate candidates detected across sources (email, profile URL, or name+phone).
        Confirm a merge to keep one record and fold the other into it — the merge is recorded and
        audited. Nothing merges automatically.
      </p>

      {error ? (
        <div className="card" style={{ marginTop: 16 }}>
          <span className="badge bad">Error</span>
          <p className="muted">{error}</p>
        </div>
      ) : null}

      {loading ? (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="muted">Scanning…</p>
        </div>
      ) : rows.length === 0 && !error ? (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="muted">No likely duplicates found. The candidate list is clean.</p>
        </div>
      ) : (
        rows.map((r, idx) => {
          const survivor = r.flipped ? r.duplicateTitle : r.survivorTitle;
          const duplicate = r.flipped ? r.survivorTitle : r.duplicateTitle;
          return (
            <div className="card" style={{ marginTop: 16 }} key={`${r.survivorId}:${r.duplicateId}`}>
              <div className="qtop">
                <span className={strengthBadge(r.strength)}>{r.strength}</span>
                <span className="badge neutral">{r.reason}</span>
              </div>
              <div className="kv">
                <span className="muted">Keep</span>
                <span>{survivor ?? "—"}</span>
              </div>
              <div className="kv">
                <span className="muted">Merge &amp; remove</span>
                <span>{duplicate ?? "—"}</span>
              </div>
              {r.error ? <p className="muted">⚠ {r.error}</p> : null}
              <div className="row" style={{ gap: 8, marginTop: 8 }}>
                {r.merged ? (
                  <span className="badge ok">Merged</span>
                ) : (
                  <>
                    <button className="btn" onClick={() => merge(idx)} disabled={r.busy}>
                      {r.busy ? "Merging…" : "Confirm merge"}
                    </button>
                    <button
                      className="btn secondary"
                      onClick={() => update(idx, { flipped: !r.flipped })}
                      disabled={r.busy}
                    >
                      ⇄ Swap which is kept
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
