"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, type IconName } from "./icons";
import { ENTERPRISE_OBJECTS, RECENT_COMMANDS } from "@/lib/runtime-console/data";

interface Entry {
  id: string;
  group: string;
  label: string;
  icon: IconName;
  meta?: string;
  objectId?: string;
}

export function CommandPalette({
  open,
  onClose,
  onOpenObject,
  onRun,
}: {
  open: boolean;
  onClose: () => void;
  onOpenObject: (id: string) => void;
  onRun: (label: string) => void;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const entries = useMemo<Entry[]>(() => {
    const objs: Entry[] = ENTERPRISE_OBJECTS.map((o) => ({
      id: `obj-${o.id}`,
      group: "Enterprise Objects",
      label: o.name,
      icon: o.icon,
      meta: o.count,
      objectId: o.id,
    }));
    const cmds: Entry[] = RECENT_COMMANDS.map((c) => ({
      id: `cmd-${c.id}`,
      group: "Recent Commands",
      label: c.label,
      icon: c.icon,
      meta: c.ago,
    }));
    return [...cmds, ...objs];
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return entries;
    return entries.filter((e) => e.label.toLowerCase().includes(t) || e.group.toLowerCase().includes(t));
  }, [q, entries]);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      const id = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [open]);

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  if (!open) return null;

  const runEntry = (e: Entry | undefined) => {
    if (!e) return;
    if (e.objectId) onOpenObject(e.objectId);
    else onRun(e.label);
    onClose();
  };

  const onKey = (ev: React.KeyboardEvent) => {
    if (ev.key === "Escape") onClose();
    else if (ev.key === "ArrowDown") {
      ev.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      runEntry(filtered[active]);
    }
  };

  // Group consecutive entries for display.
  let lastGroup = "";

  return (
    <div className="eor-overlay" onMouseDown={onClose} role="presentation">
      <div
        className="eor-palette"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
      >
        <div className="eor-palette-input">
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            value={q}
            placeholder="Search objects, run a command…"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
          />
          <span className="eor-kbd">ESC</span>
        </div>
        <div className="eor-palette-list" role="listbox">
          {filtered.length === 0 && <div className="eor-palette-empty">No matching objects or commands.</div>}
          {filtered.map((e, i) => {
            const header = e.group !== lastGroup ? e.group : null;
            lastGroup = e.group;
            return (
              <div key={e.id}>
                {header && <div className="eor-palette-group">{header}</div>}
                <button
                  type="button"
                  className={`eor-palette-item${i === active ? " active" : ""}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => runEntry(e)}
                  role="option"
                  aria-selected={i === active}
                >
                  <span className="ico">
                    <Icon name={e.icon} size={16} />
                  </span>
                  {e.label}
                  {e.meta && <span className="meta">{e.meta}</span>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
