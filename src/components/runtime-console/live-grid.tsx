"use client";

// ─────────────────────────────────────────────────────────────────────────
// LIS · Live object grid + multi-select governed toolbar (deferred LIS-001)
//   Reads projected instances from the event-sourced runtime store. Selecting
//   rows raises a floating contextual toolbar whose actions are GOVERNED store
//   mutations (emit events, reversible). Count-up + pulse microanimations honor
//   prefers-reduced-motion.
// ─────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./icons";
import type { EnterpriseObject } from "./nav-store";
import {
  runtimeStore,
  useRuntimeObject,
  type RuntimeInstance,
} from "./runtime-store";

const REDUCED =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Eased count-up to a numeric target; respects reduced-motion. */
function useCountUp(target: number, decimals = 0): string {
  const [val, setVal] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    if (REDUCED || from === target) {
      setVal(target);
      fromRef.current = target;
      return;
    }
    const dur = 460;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return val.toFixed(decimals);
}

function MetricCell({ inst }: { inst: RuntimeInstance }) {
  const decimals = inst.metricUnit === "M" ? 1 : 0;
  const shown = useCountUp(inst.metricValue, decimals);
  return (
    <span className={`lis-gx-metric t-${inst.tone}`}>
      {shown}
      {inst.metricUnit}
      <span className="lis-gx-metric-label">{inst.metricLabel}</span>
    </span>
  );
}

function StageChip({ stage }: { stage: NonNullable<RuntimeInstance["stage"]> }) {
  return <span className={`lis-gx-stage s-${stage.toLowerCase()}`}>{stage}</span>;
}

export function LiveGrid({
  object,
  onCompare,
  onToast,
}: {
  object: EnterpriseObject;
  onCompare: (ids: string[]) => void;
  onToast: (msg: string) => void;
}) {
  const rows = useRuntimeObject(object);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Track recently-changed rows to pulse them.
  const [pulsed, setPulsed] = useState<Set<string>>(new Set());
  const prevRef = useRef<Map<string, string>>(new Map());

  // Clear selection when the object changes.
  useEffect(() => {
    setSelected(new Set());
  }, [object]);

  // Detect projection changes per row → pulse.
  useEffect(() => {
    const changed = new Set<string>();
    for (const r of rows) {
      const sig = `${r.stage}|${r.approved}|${r.metricValue}|${r.tags.length}`;
      const prev = prevRef.current.get(r.id);
      if (prev !== undefined && prev !== sig) changed.add(r.id);
      prevRef.current.set(r.id, sig);
    }
    if (changed.size) {
      setPulsed(changed);
      const t = setTimeout(() => setPulsed(new Set()), 900);
      return () => clearTimeout(t);
    }
  }, [rows]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const ids = [...selected];

  return (
    <div className="lis-pane lis-pane-pad lis-gx-wrap">
      <div className="lis-gx" role="grid" aria-label={`${object} instances`}>
        <div className="lis-gx-head" role="row">
          <span className="lis-gx-check">
            <input
              type="checkbox"
              aria-label="Select all"
              checked={allSelected}
              onChange={() =>
                setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))
              }
            />
          </span>
          <span>Object instance</span>
          <span>Stage</span>
          <span className="lis-gx-mcol">Metric</span>
        </div>
        {rows.map((r) => {
          const sel = selected.has(r.id);
          return (
            <div
              key={r.id}
              role="row"
              className={`lis-gx-row${sel ? " sel" : ""}${pulsed.has(r.id) ? " pulse" : ""}`}
            >
              <span className="lis-gx-check">
                <input
                  type="checkbox"
                  aria-label={`Select ${r.label}`}
                  checked={sel}
                  onChange={() => toggle(r.id)}
                />
              </span>
              <span className="lis-gx-ident">
                <span className="lis-gx-name">
                  {r.label}
                  {r.approved && (
                    <span className="lis-gx-approved" title="Approved">
                      <Icon name="check" size={11} />
                    </span>
                  )}
                </span>
                <span className="lis-gx-detail">{r.detail}</span>
                {r.tags.length > 0 && (
                  <span className="lis-gx-tags">
                    {r.tags.map((t) => (
                      <span className="lis-gx-tag" key={t}>
                        {t}
                      </span>
                    ))}
                  </span>
                )}
              </span>
              <span>{r.stage ? <StageChip stage={r.stage} /> : <span className="lis-gx-dash">—</span>}</span>
              <span className="lis-gx-mcol">
                <MetricCell inst={r} />
              </span>
            </div>
          );
        })}
      </div>
      <p className="lis-pane-sub" style={{ marginTop: 12 }}>
        Live projection from the append-only event log. Governed actions emit events and re-project
        — counts animate and rows pulse on change.
      </p>

      {selected.size > 0 && (
        <SelectionToolbar
          count={selected.size}
          object={object}
          onClear={() => setSelected(new Set())}
          onCompare={() => onCompare(ids)}
          onTag={() => {
            const n = runtimeStore.tag(ids, "Shortlist");
            onToast(`Tagged ${n} ${n === 1 ? "object" : "objects"} "Shortlist" · governed events appended`);
          }}
          onAdvance={() => {
            let moved = 0;
            ids.forEach((id) => {
              if (runtimeStore.advanceStage(id)) moved++;
            });
            onToast(
              moved > 0
                ? `${moved} advanced one stage · ${moved} governed events appended`
                : "No selected objects could advance",
            );
          }}
          onApprove={() => {
            let n = 0;
            ids.forEach((id) => {
              if (runtimeStore.approve(id)) n++;
            });
            onToast(n > 0 ? `${n} approved · governed events appended` : "Already approved");
          }}
        />
      )}
    </div>
  );
}

function ToolBtn({
  icon,
  label,
  onClick,
  tone,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  tone?: "primary";
}) {
  return (
    <button
      type="button"
      className={`lis-seltool-btn lis-focusable${tone === "primary" ? " primary" : ""}`}
      onClick={onClick}
    >
      <Icon name={icon} size={14} />
      {label}
    </button>
  );
}

function SelectionToolbar({
  count,
  object,
  onClear,
  onCompare,
  onTag,
  onAdvance,
  onApprove,
}: {
  count: number;
  object: EnterpriseObject;
  onClear: () => void;
  onCompare: () => void;
  onTag: () => void;
  onAdvance: () => void;
  onApprove: () => void;
}) {
  const isCandidates = object === "candidates";
  return (
    <div className="lis-seltool" role="toolbar" aria-label="Bulk actions">
      <span className="lis-seltool-count">{count} selected</span>
      <span className="lis-seltool-div" />
      <ToolBtn icon="objects" label="Compare" onClick={onCompare} tone="primary" />
      <ToolBtn icon="hash" label="Tag" onClick={onTag} />
      {isCandidates && <ToolBtn icon="chevron" label="Advance" onClick={onAdvance} />}
      {isCandidates && <ToolBtn icon="check" label="Approve" onClick={onApprove} />}
      <span className="lis-seltool-div" />
      <button type="button" className="lis-seltool-x lis-focusable" aria-label="Clear selection" onClick={onClear}>
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}
