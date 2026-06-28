"use client";

// ─────────────────────────────────────────────────────────────────────────
// LIS · Consolidated workspace — the whole system in one frame.
//   LIS-002 WorkspaceShell (Canvas / Shelf) frames:
//     canvas         = LIS-003 NavMesh (rail · tabs · omnibar, live data)
//     rightInspector = governance shelf (live audit + reversibility)
//     bottomTerminal = append-only event stream tailing the runtime store
//   Layout posture persists via useLayoutMemory. Governed mutations from the
//   mesh's toolbar appear live in the inspector + terminal (one source of truth).
// ─────────────────────────────────────────────────────────────────────────

import "./lis.css";
import "./lis-shell.css";
import "./nav-mesh.css";
import { Icon } from "./icons";
import { NavMesh } from "./nav-mesh";
import { WorkspaceShell, useLayoutMemory } from "./lis-shell";
import { runtimeStore, useRuntimeEvents, useRuntimeProjection } from "./runtime-store";

const EVENT_TONE: Record<string, string> = {
  "stage.advanced": "good",
  "candidate.approved": "good",
  "instance.tagged": "accent",
  "instance.reverted": "warn",
  "object.seeded": "muted",
};

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return `${m}m ago`;
}

function GovernanceInspector() {
  const events = useRuntimeEvents();
  const instances = useRuntimeProjection();
  const governed = events.filter((e) => e.type !== "object.seeded");
  const approved = instances.filter((i) => i.approved).length;
  const reversible = governed.filter((e) => e.reversible && e.type !== "instance.reverted").length;

  return (
    <div className="lis-gov">
      <div className="lis-gov-kpis">
        <div className="lis-gov-kpi">
          <span className="lis-gov-kpi-v">{governed.length}</span>
          <span className="lis-gov-kpi-k">Governed events</span>
        </div>
        <div className="lis-gov-kpi">
          <span className="lis-gov-kpi-v t-good">{approved}</span>
          <span className="lis-gov-kpi-k">Approved</span>
        </div>
        <div className="lis-gov-kpi">
          <span className="lis-gov-kpi-v">{reversible}</span>
          <span className="lis-gov-kpi-k">Reversible</span>
        </div>
      </div>

      <button
        type="button"
        className="lis-gov-revert lis-focusable"
        disabled={reversible === 0}
        onClick={() => runtimeStore.revertLast()}
      >
        <Icon name="clock" size={13} /> Revert last governed action
      </button>

      <div className="lis-gov-h">Audit trail</div>
      <div className="lis-gov-log">
        {[...governed].reverse().slice(0, 18).map((e) => (
          <div className="lis-gov-row" key={e.seq}>
            <span className={`lis-gov-dot t-${EVENT_TONE[e.type] ?? "muted"}`} aria-hidden />
            <span className="lis-gov-sum">{e.summary}</span>
            <span className="lis-gov-meta">
              {e.actor} · {timeAgo(e.ts)}
            </span>
          </div>
        ))}
        {governed.length === 0 && (
          <div className="lis-gov-empty">No governed actions yet — act on objects in the grid.</div>
        )}
      </div>
    </div>
  );
}

function EventStreamTerminal() {
  const events = useRuntimeEvents();
  return (
    <div className="lis-term">
      <div className="lis-term-bar">
        <span className="lis-term-dot" /> append-only event stream · {events.length} total
      </div>
      <div className="lis-term-body">
        {[...events].reverse().slice(0, 40).map((e) => (
          <div className="lis-term-line" key={e.seq}>
            <span className="lis-term-seq">#{String(e.seq).padStart(3, "0")}</span>
            <span className={`lis-term-type t-${EVENT_TONE[e.type] ?? "muted"}`}>{e.type}</span>
            <span className="lis-term-inst">{e.instanceId}</span>
            <span className="lis-term-sum">{e.summary}</span>
            {e.reversible && <span className="lis-term-rev">reversible</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function LisWorkspace() {
  const { initialState, onLayoutChange } = useLayoutMemory("lis.workspace.v1");
  return (
    <WorkspaceShell
      layoutState="expanded-flex"
      initialState={initialState}
      onLayoutChange={onLayoutChange}
      canvas={<NavMesh />}
      rightInspector={<GovernanceInspector />}
      rightLabel="Governance"
      bottomTerminal={<EventStreamTerminal />}
      bottomLabel="Event stream"
    />
  );
}
