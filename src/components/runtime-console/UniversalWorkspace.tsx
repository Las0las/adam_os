"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "./icons";
import {
  ENTERPRISE_OBJECTS,
  SELECTED_OBJECTS,
  WORKSPACE_PROJECTIONS,
  type WorkspaceProjection,
} from "@/lib/runtime-console/data";

const TABS = ["Overview", "Relationships", "Evidence", "Actions", "Audit"] as const;
type Tab = (typeof TABS)[number];

function resolveHeader(objectId: string): { name: string; kind: string; icon: IconName } {
  const sel = SELECTED_OBJECTS.find((s) => s.id === objectId);
  if (sel) return { name: sel.name, kind: sel.kind, icon: sel.icon };
  const obj = ENTERPRISE_OBJECTS.find((o) => o.id === objectId);
  if (obj) return { name: obj.name, kind: "Object collection", icon: obj.icon };
  return { name: objectId, kind: "Object", icon: "objects" };
}

function Pane({ tab, p }: { tab: Tab; p: WorkspaceProjection }) {
  if (tab === "Overview") {
    return (
      <dl className="eor-ws-kv">
        {p.overview.map((o) => (
          <div style={{ display: "contents" }} key={o.label}>
            <dt>{o.label}</dt>
            <dd>{o.value}</dd>
          </div>
        ))}
      </dl>
    );
  }
  if (tab === "Relationships") {
    return (
      <div>
        {p.relationships.map((r) => (
          <div className="eor-ws-rel" key={`${r.kind}-${r.name}`}>
            <span className="eor-ws-rel-kind">{r.kind}</span>
            <span className="eor-ws-rel-name">{r.name}</span>
            <span className="eor-ws-rel-rel">{r.rel}</span>
          </div>
        ))}
      </div>
    );
  }
  if (tab === "Evidence") {
    return (
      <div>
        {p.evidence.map((e) => (
          <div className="eor-ws-ev" key={e.source}>
            <div className="eor-ws-ev-top">
              <span className="eor-ws-ev-src">{e.source}</span>
              <span className="eor-ws-ev-conf">{Math.round(e.confidence * 100)}%</span>
            </div>
            <div className="eor-ws-ev-detail">{e.detail}</div>
            <div className="eor-conf-bar" style={{ marginTop: 7 }}>
              <div className="eor-conf-fill" style={{ width: `${Math.round(e.confidence * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (tab === "Actions") {
    return (
      <div>
        {p.actions.map((a) => (
          <div className="eor-ws-action" key={a.label}>
            <span className="eor-ws-action-label">{a.label}</span>
            <span className={`chip ${a.access === "Requires approval" ? "warn" : a.access === "Read only" ? "muted" : "good"}`}>
              {a.access}
            </span>
          </div>
        ))}
        <div className="eor-ws-banner">
          <Icon name="shield" size={15} /> Actions route through the kernel. This projection never mutates directly.
        </div>
      </div>
    );
  }
  return (
    <div>
      {p.audit.map((a, i) => (
        <div className="eor-ws-ev" key={`${a.at}-${i}`}>
          <div className="eor-ws-ev-top">
            <span className="eor-ws-ev-src">{a.event}</span>
            <span className="eor-ws-ev-conf t-muted" style={{ color: "var(--dim)" }}>
              {a.at}
            </span>
          </div>
          <div className="eor-ws-ev-detail">by {a.actor}</div>
        </div>
      ))}
    </div>
  );
}

export function UniversalWorkspace({
  objectId,
  onClose,
}: {
  objectId: string | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("Overview");

  useEffect(() => {
    if (objectId) setTab("Overview");
  }, [objectId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (objectId) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [objectId, onClose]);

  if (!objectId) return null;

  const header = resolveHeader(objectId);
  const projection: WorkspaceProjection =
    WORKSPACE_PROJECTIONS[objectId] ?? WORKSPACE_PROJECTIONS["sarah-chen"]!;

  return (
    <>
      <div className="eor-ws-overlay" onMouseDown={onClose} role="presentation" />
      <aside className="eor-ws-drawer" role="dialog" aria-label={`${header.name} workspace`}>
        <div className="eor-ws-top">
          <span className="eor-ws-ico">
            <Icon name={header.icon} size={22} />
          </span>
          <div className="eor-ws-h">
            <div className="eor-ws-title">{header.name}</div>
            <div className="eor-ws-kind">{header.kind}</div>
            <span className="eor-ws-proj">
              <Icon name="sparkle" size={12} /> Projected from canonical graph
            </span>
          </div>
          <button className="eor-ws-close" type="button" onClick={onClose} aria-label="Close workspace">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="eor-ws-tabs">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              className={`eor-ws-tab${tab === t ? " active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="eor-ws-pane">
          <Pane tab={tab} p={projection} />
        </div>
      </aside>
    </>
  );
}
