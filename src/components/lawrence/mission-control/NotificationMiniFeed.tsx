"use client";

// Phase 5 — notification mini feed (Part I). The last few notifications; failed
// ones are flagged in red.

import type { CommandCenterItem } from "@/lib/domains/command-center/command-center-types";

export function NotificationMiniFeed({ items }: { items: CommandCenterItem[] }) {
  const shown = items.slice(0, 5);

  return (
    <div className="card">
      <h3>Notifications</h3>
      {shown.length === 0 ? (
        <p className="muted">No recent notifications.</p>
      ) : (
        shown.map((item) => {
          const failed = item.status === "failed";
          return (
            <div className="kv" key={item.id}>
              <span className={failed ? "" : "muted"} style={failed ? { color: "var(--bad)" } : undefined}>
                {item.title}
              </span>
              {failed ? <span className="badge bad">Failed</span> : null}
            </div>
          );
        })
      )}
    </div>
  );
}
