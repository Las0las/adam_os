"use client";

// Phase 5 — Object actions panel (Part C-UI / D). Renders a governed
// ActionButton per available action; refreshes the detail on settle.

import type { ObjectDetail } from "@/lib/domains/object-detail/object-detail-types";
import { ActionButton } from "../actions/ActionButton";

export function ObjectActionsPanel({
  actions,
  objectType,
  objectId,
  onRefresh,
}: {
  actions: ObjectDetail["actions"];
  objectType: string;
  objectId: string;
  onRefresh: () => void;
}) {
  if (!actions || actions.length === 0) {
    return <div className="muted">No actions available for this object.</div>;
  }
  return (
    <div className="btn-row">
      {actions.map((action) => (
        <ActionButton
          key={action.actionKey}
          action={action}
          context={{ objectType, objectId }}
          onSettled={onRefresh}
        />
      ))}
    </div>
  );
}
