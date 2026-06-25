"use client";

import type { CommandCenterItem } from "@/lib/domains/command-center/command-center-types";
import { CommandQueueItemCard } from "./CommandQueueItemCard";
import { CommandEmptyState } from "./CommandEmptyState";

export function CommandQueueColumn({
  title,
  items,
  generatedAt,
  onSettled,
  emptyMessage,
}: {
  title: string;
  items: CommandCenterItem[];
  generatedAt: string;
  onSettled?: () => void;
  emptyMessage?: string;
}) {
  return (
    <div className="card">
      <div className="page-title">
        {title} <span className="muted">· {items.length}</span>
      </div>
      {items.length === 0 ? (
        <CommandEmptyState message={emptyMessage} />
      ) : (
        items.map((item) => (
          <CommandQueueItemCard
            key={`${item.kind}-${item.id}`}
            item={item}
            generatedAt={generatedAt}
            onSettled={onSettled}
          />
        ))
      )}
    </div>
  );
}
