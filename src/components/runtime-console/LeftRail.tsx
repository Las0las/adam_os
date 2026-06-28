"use client";

import { Icon } from "./icons";
import {
  ENTERPRISE_OBJECTS,
  RECENT_COMMANDS,
  type EnterpriseObject,
} from "@/lib/runtime-console/data";

function ObjectRow({
  obj,
  active,
  onOpen,
}: {
  obj: EnterpriseObject;
  active: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className={`eor-obj${active ? " active" : ""}`}
      onClick={() => onOpen(obj.id)}
      aria-label={`Open ${obj.name} objects`}
    >
      <span className="eor-obj-ico">
        <Icon name={obj.icon} size={17} />
      </span>
      <span className="eor-obj-body">
        <span className="eor-obj-top">
          <span className="eor-obj-name">{obj.name}</span>
          {obj.flag && <span className={`chip ${obj.flag.tone}`}>{obj.flag.label}</span>}
        </span>
        <span className="eor-obj-count">{obj.count}</span>
        <span className="eor-obj-stats">
          {obj.stats.map((s) => (
            <span className={`st t-${s.tone}`} key={s.label}>
              <span className={`dot ${s.tone}`} />
              {s.label}
            </span>
          ))}
        </span>
      </span>
    </button>
  );
}

export function LeftRail({
  activeId,
  onOpenObject,
  onOpenPalette,
}: {
  activeId: string | null;
  onOpenObject: (id: string) => void;
  onOpenPalette: () => void;
}) {
  return (
    <aside className="eor-col eor-rail-left">
      <section className="glass" style={{ padding: "14px 12px" }}>
        <div className="eor-rail-head">
          <span className="section-label">Enterprise Objects</span>
          <button className="eor-add" type="button" aria-label="Add object">
            <Icon name="plus" size={14} />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {ENTERPRISE_OBJECTS.map((o) => (
            <ObjectRow key={o.id} obj={o} active={activeId === o.id} onOpen={onOpenObject} />
          ))}
        </div>
        <button className="eor-more" type="button">
          <Icon name="plus" size={13} /> More Objects
        </button>
      </section>

      <section className="glass eor-recent">
        <h4 className="section-label">Recent Commands</h4>
        {RECENT_COMMANDS.map((c) => (
          <button className="eor-rc" type="button" key={c.id} onClick={onOpenPalette}>
            <span className="eor-rc-ico">
              <Icon name={c.icon} size={14} />
            </span>
            <span className="eor-rc-label">{c.label}</span>
            <span className="eor-rc-ago">{c.ago}</span>
          </button>
        ))}
        <button className="eor-link" type="button" onClick={onOpenPalette}>
          View all commands <Icon name="arrow" size={13} />
        </button>
      </section>
    </aside>
  );
}
