"use client";

import type { CommandCenterItem } from "@/lib/domains/command-center/command-center-types";
import { ActionButton } from "@/components/lawrence/actions/ActionButton";

export function CommandActionButtons({
  item,
  onSettled,
}: {
  item: CommandCenterItem;
  onSettled?: () => void;
}) {
  const actions = item.actions ?? [];
  if (actions.length === 0) return null;

  return (
    <div className="btn-row">
      {actions.map((action) => (
        <ActionButton
          key={action.actionKey}
          action={action}
          context={{
            objectType: item.objectRef?.objectType,
            objectId: item.objectRef?.objectId,
          }}
          onSettled={onSettled}
        />
      ))}
    </div>
  );
}
