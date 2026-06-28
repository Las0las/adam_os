"use client";

/* ============================================================================
   LDS-001 — Command Center (⌘K)
   A reusable, keyboard-driven command palette. Routes intent; the consumer
   decides what each command does. Opens on ⌘K / Ctrl+K, closes on Esc.
   ========================================================================== */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export interface CommandItem {
  id: string;
  label: string;
  group?: string;
  icon?: ReactNode;
  keywords?: string;
  shortcut?: string;
  run: () => void;
}

export function useCommandCenter() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { open, setOpen };
}

export function CommandCenter({ open, onClose, items, placeholder = "Search or run a command…" }: { open: boolean; onClose: () => void; items: CommandItem[]; placeholder?: string }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      const t = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((it) => (`${it.label} ${it.group ?? ""} ${it.keywords ?? ""}`).toLowerCase().includes(term));
  }, [q, items]);

  const grouped = useMemo(() => {
    const m = new Map<string, CommandItem[]>();
    for (const it of filtered) {
      const g = it.group ?? "Commands";
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(it);
    }
    return [...m.entries()];
  }, [filtered]);

  if (!open) return null;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") return onClose();
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, Math.max(filtered.length - 1, 0))); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    if (e.key === "Enter") { e.preventDefault(); const it = filtered[active]; if (it) { it.run(); onClose(); } }
  }

  let flatIndex = -1;
  return (
    <div className="lds lds-cmd-overlay" onMouseDown={onClose}>
      <div className="lds-cmd" onMouseDown={(e) => e.stopPropagation()} onKeyDown={onKeyDown} role="dialog" aria-label="Command Center">
        <div className="lds-cmd-input-wrap">
          <span className="lds-mono" style={{ color: "var(--lds-faint)", fontSize: 12 }}>⌘K</span>
          <input ref={inputRef} className="lds-cmd-input" placeholder={placeholder} value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} />
          <span className="lds-kbd">ESC</span>
        </div>
        <div className="lds-cmd-list">
          {filtered.length === 0 ? (
            <div className="lds-cmd-empty">No matching commands</div>
          ) : (
            grouped.map(([group, gItems]) => (
              <div key={group}>
                <div className="lds-cmd-group">{group}</div>
                {gItems.map((it) => {
                  flatIndex += 1;
                  const idx = flatIndex;
                  return (
                    <div
                      key={it.id}
                      className={`lds-cmd-item${idx === active ? " active" : ""}`}
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => { it.run(); onClose(); }}
                    >
                      {it.icon ? <span className="ci">{it.icon}</span> : null}
                      <span>{it.label}</span>
                      {it.shortcut ? <span className="ck lds-kbd">{it.shortcut}</span> : null}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
