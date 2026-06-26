"use client";

// Phase 6 — Approval request mutation actions (approve / reject). POSTs to the
// approvals endpoints, parses the envelope, refetches via onSettled.

import { useCallback } from "react";
import { postJson, useMutationRunner, type Envelope } from "./missionControlPost";

export interface UseApprovalActions {
  pending: boolean;
  error: string | null;
  approve: (approvalId: string, note?: string) => Promise<Envelope>;
  reject: (approvalId: string, note?: string) => Promise<Envelope>;
}

export function useApprovalActions(onSettled: () => void): UseApprovalActions {
  const { pending, error, run } = useMutationRunner(onSettled);

  const approve = useCallback(
    (approvalId: string, note?: string) =>
      run(() =>
        postJson(
          `/api/mission-control/approvals/${encodeURIComponent(approvalId)}/approve`,
          { note },
        ),
      ),
    [run],
  );

  const reject = useCallback(
    (approvalId: string, note?: string) =>
      run(() =>
        postJson(
          `/api/mission-control/approvals/${encodeURIComponent(approvalId)}/reject`,
          { note },
        ),
      ),
    [run],
  );

  return { pending, error, approve, reject };
}
