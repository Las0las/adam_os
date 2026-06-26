"use client";

// Phase 6 — Release bundle detail drawer. Given a releaseId, fetches
// GET /releases/[id] (returns { release, items, validation }) and renders
// metadata, items, validation blockers/warnings, and lifecycle fields.

import { useEffect, useRef, useState } from "react";
import type {
  ReleaseBundle,
  ReleaseBundleItem,
} from "@/lib/mission-control/runtime/mission-control-hardening-types";
import { StatusBadge } from "@/components/lawrence/shared/widgets";

interface ReleaseValidation {
  valid: boolean;
  blockers: string[];
  warnings: string[];
}

interface ReleaseDetail {
  release: ReleaseBundle;
  items: ReleaseBundleItem[];
  validation: ReleaseValidation;
}

export function ReleaseBundleDetailDrawer({
  releaseId,
  onClose,
}: {
  releaseId: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<ReleaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    setDetail(null);

    fetch(`/api/mission-control/releases/${encodeURIComponent(releaseId)}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as
          | { ok?: boolean; data?: ReleaseDetail; error?: string }
          | null;
        if (!res.ok || !body?.ok || !body.data) {
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        return body.data;
      })
      .then((next) => {
        if (controller.signal.aborted) return;
        setDetail(next);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => controller.abort();
  }, [releaseId]);

  const release = detail?.release;

  return (
    <div className="card" role="dialog" aria-label="Release detail">
      <div className="row">
        <h3>Release detail</h3>
        <button type="button" className="btn" onClick={onClose}>
          Close
        </button>
      </div>

      {error ? <p className="badge bad">Failed to load: {error}</p> : null}
      {loading && !detail ? <p className="muted">Loading…</p> : null}

      {release ? (
        <>
          <div className="kv">
            <span className="muted">Name</span>
            <span>{release.name}</span>
          </div>
          <div className="kv">
            <span className="muted">Key</span>
            <span>{release.key}</span>
          </div>
          <div className="kv">
            <span className="muted">Status</span>
            <StatusBadge status={release.status} />
          </div>
          <div className="kv">
            <span className="muted">Type</span>
            <span>{release.releaseType}</span>
          </div>
          {release.description ? (
            <div className="kv">
              <span className="muted">Description</span>
              <span>{release.description}</span>
            </div>
          ) : null}
          <div className="kv">
            <span className="muted">Created by</span>
            <span>{release.createdBy ?? "—"}</span>
          </div>
          <div className="kv">
            <span className="muted">Approved by</span>
            <span>{release.approvedBy ?? "—"}</span>
          </div>
          <div className="kv">
            <span className="muted">Promoted by</span>
            <span>{release.promotedBy ?? "—"}</span>
          </div>
          {release.rollbackOfReleaseId ? (
            <div className="kv">
              <span className="muted">Rollback of</span>
              <span>{release.rollbackOfReleaseId}</span>
            </div>
          ) : null}

          <h4>Items ({detail?.items.length ?? 0})</h4>
          {detail && detail.items.length > 0 ? (
            <table className="cc-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Key</th>
                  <th>Change</th>
                  <th>Version</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.itemType}</td>
                    <td>{item.itemKey ?? item.itemId ?? "—"}</td>
                    <td>{item.changeType}</td>
                    <td>{item.itemVersion ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">No items.</p>
          )}

          <h4>Validation</h4>
          {detail ? (
            <>
              <div className="kv">
                <span className="muted">Valid</span>
                <span
                  className={`badge ${detail.validation.valid ? "good" : "bad"}`}
                >
                  {detail.validation.valid ? "valid" : "invalid"}
                </span>
              </div>
              {detail.validation.blockers.length > 0 ? (
                <ul>
                  {detail.validation.blockers.map((b, i) => (
                    <li key={`blocker-${i}`} className="badge bad">
                      {b}
                    </li>
                  ))}
                </ul>
              ) : null}
              {detail.validation.warnings.length > 0 ? (
                <ul>
                  {detail.validation.warnings.map((w, i) => (
                    <li key={`warning-${i}`} className="badge warn">
                      {w}
                    </li>
                  ))}
                </ul>
              ) : null}
              {detail.validation.blockers.length === 0 &&
              detail.validation.warnings.length === 0 ? (
                <p className="muted">No blockers or warnings.</p>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
