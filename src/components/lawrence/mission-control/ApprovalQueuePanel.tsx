"use client";

// Phase 6 — Approval queue panel. Lists pending approval requests with
// Approve / Reject actions. Reject reveals an inline note textarea.

import { useState } from "react";
import type { ApprovalRequest } from "@/lib/mission-control/runtime/mission-control-hardening-types";
import { timeAgo } from "./missionControlFormat";

export function ApprovalQueuePanel({
  approvals,
  pending,
  onApprove,
  onReject,
}: {
  approvals: ApprovalRequest[];
  pending: boolean;
  onApprove: (approvalId: string, note?: string) => void;
  onReject: (approvalId: string, note?: string) => void;
}) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const startReject = (id: string) => {
    setRejectingId(id);
    setNote("");
  };

  const confirmReject = (id: string) => {
    onReject(id, note.trim() || undefined);
    setRejectingId(null);
    setNote("");
  };

  return (
    <div className="card">
      <h3>Approval queue</h3>
      {approvals.length === 0 ? (
        <p className="muted">No pending approvals.</p>
      ) : (
        approvals.map((approval) => (
          <div className="card" key={approval.id}>
            <div className="kv">
              <span className="muted">Subject</span>
              <span>
                {approval.subjectType}: {approval.subjectId}
              </span>
            </div>
            {approval.reason ? (
              <div className="kv">
                <span className="muted">Reason</span>
                <span>{approval.reason}</span>
              </div>
            ) : null}
            <div className="kv">
              <span className="muted">Requested by</span>
              <span>{approval.requestedBy ?? "—"}</span>
            </div>
            <div className="kv">
              <span className="muted">Created</span>
              <span>{timeAgo(approval.createdAt)}</span>
            </div>

            {rejectingId === approval.id ? (
              <>
                <textarea
                  value={note}
                  placeholder="Rejection note (optional)"
                  onChange={(e) => setNote(e.target.value)}
                />
                <div className="btn-row">
                  <button
                    type="button"
                    className="btn"
                    disabled={pending}
                    onClick={() => confirmReject(approval.id)}
                  >
                    Confirm reject
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setRejectingId(null)}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <div className="btn-row">
                <button
                  type="button"
                  className="btn"
                  disabled={pending}
                  onClick={() => onApprove(approval.id)}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={pending}
                  onClick={() => startReject(approval.id)}
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
