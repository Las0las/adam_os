"use client";

import { Icon } from "./icons";
import { ContextZone, IntentPreview, useClipboard, type MenuItem } from "./lis";
import {
  ENTERPRISE_OBJECTS,
  OBJECT_INTENT,
  objectCopyPayload,
  objectLink,
  RECENT_COMMANDS,
  type EnterpriseObject,
} from "@/lib/runtime-console/data";

function ObjectRow({
  obj,
  active,
  onOpen,
  onToast,
}: {
  obj: EnterpriseObject;
  active: boolean;
  onOpen: (id: string) => void;
  onToast: (msg: string) => void;
}) {
  const copy = useClipboard();
  const menu: MenuItem[] = [
    {
      id: `${obj.id}-link`,
      label: "Copy link",
      icon: "link",
      kbd: "⌘L",
      flashOnRun: true,
      run: () => copy(objectLink(obj.id)),
    },
    {
      id: `${obj.id}-json`,
      label: "Copy as JSON",
      icon: "code",
      flashOnRun: true,
      run: () => copy(objectCopyPayload(obj.id, obj.name, "Object collection")),
    },
    {
      id: `${obj.id}-id`,
      label: "Copy object ID",
      icon: "hash",
      flashOnRun: true,
      run: () => copy(obj.id),
    },
    { id: `${obj.id}-sep`, label: "", icon: "link", sep: true, run: () => false },
    {
      id: `${obj.id}-open`,
      label: "Open in Workspace",
      icon: "open",
      run: () => {
        onOpen(obj.id);
        return false;
      },
    },
    {
      id: `${obj.id}-pin`,
      label: "Pin to workspace",
      icon: "pin",
      run: () => {
        onToast(`${obj.name} pinned to workspace`);
        return false;
      },
    },
  ];
  const row = (
    <button
      type="button"
      className={`eor-obj lis-intent lis-focusable${active ? " active" : ""}`}
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
  const meta = OBJECT_INTENT[obj.id];
  return (
    <ContextZone items={menu}>
      {meta ? <IntentPreview meta={meta}>{row}</IntentPreview> : row}
    </ContextZone>
  );
}

export function LeftRail({
  activeId,
  onOpenObject,
  onOpenPalette,
  onToast,
}: {
  activeId: string | null;
  onOpenObject: (id: string) => void;
  onOpenPalette: () => void;
  onToast: (msg: string) => void;
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
            <ObjectRow
              key={o.id}
              obj={o}
              active={activeId === o.id}
              onOpen={onOpenObject}
              onToast={onToast}
            />
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
