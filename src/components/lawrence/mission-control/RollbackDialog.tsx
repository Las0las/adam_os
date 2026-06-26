"use client";

// Phase 6 — Rollback dialog. Controlled by a releaseId. Requires a non-empty
// reason and a checked confirm box before submit is enabled; submitting calls
// requestRollback(releaseId, reason, emergency?).

import { useState } from "react";

export function RollbackDialog({
  releaseId,
  pending,
  onSubmit,
  onClose,
}: {
  releaseId: string;
  pending: boolean;
  onSubmit: (
    releaseId: string,
    reason: string,
    emergency?: boolean,
  ) => Promise<{ ok: boolean }>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [emergency, setEmergency] = useState(false);

  const canSubmit = reason.trim().length > 0 && confirmed && !pending;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const result = await onSubmit(releaseId, reason.trim(), emergency);
    if (result.ok) onClose();
  };

  return (
    <div className="card" role="dialog" aria-label="Rollback release">
      <div className="row">
        <h3>Rollback release</h3>
        <button type="button" className="btn" onClick={onClose}>
          Close
        </button>
      </div>

      <label className="kv">
        <span className="muted">Reason *</span>
        <textarea
          value={reason}
          placeholder="Why is this release being rolled back?"
          onChange={(e) => setReason(e.target.value)}
        />
      </label>

      <label className="btn-row">
        <input
          type="checkbox"
          checked={emergency}
          onChange={(e) => setEmergency(e.target.checked)}
        />
        <span>Emergency rollback</span>
      </label>

      <label className="btn-row">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>I confirm this rollback</span>
      </label>

      <div className="btn-row">
        <button
          type="button"
          className="btn"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          Request rollback
        </button>
      </div>
    </div>
  );
}
