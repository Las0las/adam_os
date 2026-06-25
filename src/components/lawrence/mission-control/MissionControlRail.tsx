"use client";

// Phase 5 — Mission Control side rail (Part I). Composes the runtime health,
// approval, and notification mini-panels. The Command Center overview is fetched
// once here and sliced down to the approval/notification panels; runtime health
// has its own hook.

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CommandCenterItem } from "@/lib/domains/command-center/command-center-types";
import { RuntimeHealthMiniPanel } from "./RuntimeHealthMiniPanel";
import { ApprovalMiniQueue } from "./ApprovalMiniQueue";
import { NotificationMiniFeed } from "./NotificationMiniFeed";

interface OverviewSlices {
  actionQueue: CommandCenterItem[];
  notificationQueue: CommandCenterItem[];
  incidentQueue: CommandCenterItem[];
}

export function MissionControlRail() {
  const [slices, setSlices] = useState<OverviewSlices>({
    actionQueue: [],
    notificationQueue: [],
    incidentQueue: [],
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();

    fetch("/api/command-center/overview?mode=executive", { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as { ok?: boolean; data?: Partial<OverviewSlices> };
      })
      .then((body) => {
        const data = body?.data ?? {};
        setSlices({
          actionQueue: Array.isArray(data.actionQueue) ? data.actionQueue : [],
          notificationQueue: Array.isArray(data.notificationQueue) ? data.notificationQueue : [],
          incidentQueue: Array.isArray(data.incidentQueue) ? data.incidentQueue : [],
        });
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => ctrl.abort();
  }, []);

  return (
    <aside className="rail">
      <div className="row" style={{ borderBottom: "none", padding: 0 }}>
        <strong>Mission Control</strong>
        <Link href="/mission-control" className="muted">
          Open
        </Link>
      </div>

      <RuntimeHealthMiniPanel />
      <ApprovalMiniQueue items={slices.actionQueue} />
      <NotificationMiniFeed items={slices.notificationQueue} />

      {error ? <p className="muted">Overview unavailable: {error}</p> : null}
    </aside>
  );
}
