"use client";

// Phase 5 — review decision bar (Part E). Renders the four review decision
// actions (Approve / Reject / Request Changes / Escalate) as governed
// ActionButtons scoped to a single review case. Resolving refreshes the queue.

import { ActionButton } from "@/components/lawrence/actions/ActionButton";
import { availableActionsForObject } from "@/lib/domains/object-detail/available-actions";

export function ReviewDecisionBar({
  caseId,
  onSettled,
}: {
  caseId: string;
  onSettled?: () => void;
}) {
  const actions = availableActionsForObject("ReviewCase");

  return (
    <div className="btn-row">
      {actions.map((action) => (
        <ActionButton
          key={`${action.actionKey}:${String(action.input?.decision ?? "")}`}
          action={action}
          context={{ reviewCaseId: caseId }}
          onSettled={onSettled}
        />
      ))}
    </div>
  );
}
