"use client";

// Phase 5 — approval mini queue (Part I). Items awaiting approval, linking to
// the full Review Queue.

import Link from "next/link";
import type { CommandCenterItem } from "@/lib/domains/command-center/command-center-types";

export function ApprovalMiniQueue({ items }: { items: CommandCenterItem[] }) {
  const awaiting = items.filter((i) => i.status === "awaiting_approval");
  const shown = awaiting.slice(0, 5);

  return (
    <div className="card">
      <div className="row" style={{ borderBottom: "none", padding: 0 }}>
        <h3 style={{ margin: 0 }}>Awaiting approval</h3>
        <Link href="/command-center/review-queue" className="muted">
          View all
        </Link>
      </div>
      {awaiting.length === 0 ? (
        <p className="muted">Nothing awaiting approval.</p>
      ) : (
        <>
          {shown.map((item) => (
            <div className="kv" key={item.id}>
              <Link href="/command-center/review-queue">{item.title}</Link>
            </div>
          ))}
          {awaiting.length > shown.length ? (
            <p className="muted">+{awaiting.length - shown.length} more</p>
          ) : null}
        </>
      )}
    </div>
  );
}
