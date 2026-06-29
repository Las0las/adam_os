"use client";

// ─────────────────────────────────────────────────────────────────────────
// LIS-003 · Three-Layer Navigation Mesh (unified prototype)
//   Layer 1  Left Workspace Rail   — switch enterprise OBJECT
//   Layer 2  Object Surface Tabs   — switch LENS (surface) of the active object
//   Layer 3  Omnibar Pivot Engine  — ⌘K natural/slash pivots, atomic in one tick
// All three read & write ONE store (nav-store). Surfaces are projected
// non-destructively: inactive surfaces stay mounted (display:none) so scroll,
// focus, undo history and stream buffers survive a lens switch.
// ─────────────────────────────────────────────────────────────────────────

import { useEffect, useId, useRef, useState } from "react";
import "./nav-mesh.css";
import { Icon } from "./icons";
import { InlineProjector } from "./inline-projector";
import { LiveGrid } from "./live-grid";
import {
  runtimeStore,
  useRuntimeInstance,
  useRuntimeObject,
  useRuntimeProjection,
} from "./runtime-store";
import {
  ALL_SURFACES,
  OBJECTS,
  SURFACE_META,
  useNavStore,
  type CanonicalSurface,
  type EnterpriseObject,
} from "./nav-store";

export function NavMesh() {
  const activeObject = useNavStore((s) => s.activeObject);
  const activeLabel = useNavStore((s) => s.activeLabel);
  const activeSurface = useNavStore((s) => s.activeSurface);
  const mountedInstances = useNavStore((s) => s.mountedInstances);
  const activeId = useNavStore((s) => s.activeId);
  const setSurface = useNavStore((s) => s.setSurface);

  const [toast, setToast] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[] | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  };

  // Global hotkeys: Alt+1..6 cycle the pinned surfaces.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && !Number.isNaN(Number(e.key))) {
        const idx = Number(e.key) - 1;
        const order: CanonicalSurface[] = [
          "overview",
          "grid",
          "document",
          "canvas",
          "composer",
          "ai_studio",
        ];
        const target = order[idx];
        if (target) {
          e.preventDefault();
          setSurface(target);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSurface]);

  return (
    <div className="lis-mesh">
      <LeftWorkspaceRail />
      <div className="lis-mesh-main">
        <header className="lis-mesh-header">
          <div className="lis-breadcrumb">
            <span className="lis-crumb-obj">{activeObject}</span>
            <span className="lis-crumb-sep">/</span>
            <span className="lis-crumb-id">{activeLabel}</span>
          </div>
          <OmnibarPivotEngine />
        </header>

        <ObjectSurfaceTabBar />

        <main className="lis-viewport">
          {/* Active instance projects all of its surfaces; only one is shown. */}
          {ALL_SURFACES.map((surface) => (
            <SurfaceProjectionContainer
              key={surface}
              surfaceId={surface}
              active={activeSurface === surface}
            >
              <SurfaceContent
                surface={surface}
                instanceId={activeId}
                label={activeLabel}
                object={activeObject}
                onCompare={(ids) => setCompareIds(ids)}
                onToast={showToast}
              />
            </SurfaceProjectionContainer>
          ))}
          <div className="lis-mesh-cachenote">
            {mountedInstances.length} instance{mountedInstances.length === 1 ? "" : "s"} cached ·{" "}
            {ALL_SURFACES.length} surfaces mounted (state preserved)
          </div>
        </main>
      </div>

      {toast && (
        <div className="lis-mesh-toast" role="status">
          <Icon name="check" size={15} /> {toast}
          <button
            type="button"
            className="lis-mesh-toast-undo"
            onClick={() => {
              const rev = runtimeStore.revertLast();
              showToast(rev ? rev.summary : "Nothing to revert");
            }}
          >
            Undo
          </button>
        </div>
      )}

      {compareIds && <CompareOverlay ids={compareIds} onClose={() => setCompareIds(null)} />}
    </div>
  );
}

// ── Compare overlay (multi-select → side-by-side) ────────────────────────────
function CompareOverlay({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const all = useRuntimeProjection();
  const items = all.filter((i) => ids.includes(i.id));
  return (
    <div className="lis-cmp-scrim" onClick={onClose}>
      <div
        className="lis-cmp"
        role="dialog"
        aria-modal="true"
        aria-label="Compare objects"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="lis-cmp-head">
          <span>Compare · {items.length} objects</span>
          <button type="button" className="lis-cmp-x lis-focusable" onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </header>
        <div className="lis-cmp-grid" style={{ gridTemplateColumns: `160px repeat(${items.length}, 1fr)` }}>
          <span className="lis-cmp-rowlabel">Instance</span>
          {items.map((i) => (
            <span key={i.id} className="lis-cmp-cell lis-cmp-name">{i.label}</span>
          ))}
          <span className="lis-cmp-rowlabel">Detail</span>
          {items.map((i) => (
            <span key={i.id} className="lis-cmp-cell">{i.detail}</span>
          ))}
          <span className="lis-cmp-rowlabel">Stage</span>
          {items.map((i) => (
            <span key={i.id} className="lis-cmp-cell">{i.stage ?? "—"}</span>
          ))}
          <span className="lis-cmp-rowlabel">{items[0]?.metricLabel ?? "Metric"}</span>
          {items.map((i) => (
            <span key={i.id} className={`lis-cmp-cell t-${i.tone}`}>
              {i.metricValue}
              {i.metricUnit}
            </span>
          ))}
          <span className="lis-cmp-rowlabel">Approved</span>
          {items.map((i) => (
            <span key={i.id} className="lis-cmp-cell">{i.approved ? "Yes" : "No"}</span>
          ))}
          <span className="lis-cmp-rowlabel">Tags</span>
          {items.map((i) => (
            <span key={i.id} className="lis-cmp-cell">{i.tags.join(", ") || "—"}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Layer 1 ──────────────────────────────────────────────────────────────────
function LeftWorkspaceRail() {
  const activeObject = useNavStore((s) => s.activeObject);
  const pivotTo = useNavStore((s) => s.pivotTo);
  return (
    <nav className="lis-mesh-rail" aria-label="Enterprise objects">
      <div className="lis-mesh-rail-mark" title="LAWRENCE">
        <Icon name="command" size={18} />
      </div>
      {OBJECTS.map((o) => (
        <RailButton key={o.id} object={o.id} icon={o.icon} label={o.label} rootId={o.rootId} rootLabel={o.rootLabel} active={activeObject === o.id} onPivot={pivotTo} />
      ))}
    </nav>
  );
}

function RailButton({
  object,
  icon,
  label,
  rootId,
  rootLabel,
  active,
  onPivot,
}: {
  object: EnterpriseObject;
  icon: import("./icons").IconName;
  label: string;
  rootId: string;
  rootLabel: string;
  active: boolean;
  onPivot: (o: EnterpriseObject, id: string, label: string) => void;
}) {
  const count = useRuntimeObject(object).length;
  return (
    <button
      type="button"
      className={`lis-mesh-rail-btn lis-focusable${active ? " active" : ""}`}
      title={`${label} · ${count}`}
      aria-label={`${label}, ${count} objects`}
      aria-current={active ? "true" : undefined}
      onClick={() => onPivot(object, rootId, rootLabel)}
    >
      <Icon name={icon} size={20} />
      {count > 0 && <span className="lis-mesh-rail-count">{count}</span>}
      {active && <span className="lis-mesh-rail-active" aria-hidden />}
    </button>
  );
}

// ── Layer 2 ──────────────────────────────────────────────────────────────────
function ObjectSurfaceTabBar() {
  const activeSurface = useNavStore((s) => s.activeSurface);
  const pinnedSurfaces = useNavStore((s) => s.pinnedSurfaces);
  const setSurface = useNavStore((s) => s.setSurface);
  const togglePin = useNavStore((s) => s.togglePinSurface);

  // Pinned surfaces first (in canonical order), then the rest.
  const ordered = [
    ...ALL_SURFACES.filter((s) => pinnedSurfaces.includes(s)),
    ...ALL_SURFACES.filter((s) => !pinnedSurfaces.includes(s)),
  ];

  return (
    <div className="lis-tabs" role="tablist" aria-label="Object surfaces">
      {ordered.map((surface) => {
        const active = activeSurface === surface;
        const pinned = pinnedSurfaces.includes(surface);
        const meta = SURFACE_META[surface];
        return (
          <div
            key={surface}
            role="tab"
            aria-selected={active}
            tabIndex={0}
            className={`lis-tab lis-focusable${active ? " active" : ""}${pinned ? " pinned" : ""}`}
            onClick={() => setSurface(surface)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSurface(surface);
              }
            }}
          >
            <Icon name={meta.icon} size={13} />
            <span className="lis-tab-label">{meta.label}</span>
            <span
              role="button"
              tabIndex={0}
              aria-label={pinned ? `Unpin ${meta.label}` : `Pin ${meta.label}`}
              className={`lis-tab-pin${pinned ? " on" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                togglePin(surface);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  togglePin(surface);
                }
              }}
            >
              <Icon name="pin" size={11} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Layer 3 ──────────────────────────────────────────────────────────────────
const OMNIBAR_HINTS = [
  { cmd: "/grid", desc: "Switch active object to data layout" },
  { cmd: "/document", desc: "Swap lens to markdown record" },
  { cmd: "@Sarah Chen /canvas", desc: "Pivot entity context immediately" },
  { cmd: "revenue", desc: "Jump to revenue, grid lens" },
];

function OmnibarPivotEngine() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const pivotTo = useNavStore((s) => s.pivotTo);
  const setSurface = useNavStore((s) => s.setSurface);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((p) => !p);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const execute = (raw: string) => {
    const cmd = raw.trim().toLowerCase();
    if (!cmd) return;

    // Model A — absolute slash pivot (lens only)
    if (cmd.startsWith("/")) {
      const t = cmd.slice(1).replace(/\s+/g, "_");
      const map: Record<string, CanonicalSurface> = {
        ai: "ai_studio",
        ai_studio: "ai_studio",
        doc: "document",
        document: "document",
        grid: "grid",
        canvas: "canvas",
        composer: "composer",
        history: "history",
        evidence: "evidence",
        relationships: "relationships",
        overview: "overview",
      };
      if (map[t]) setSurface(map[t]);
    }
    // Model B — natural compilation: entity + optional lens, atomic pivot
    else if (cmd.includes("sarah")) {
      const lens: CanonicalSurface = cmd.includes("canvas")
        ? "canvas"
        : cmd.includes("grid")
          ? "grid"
          : cmd.includes("document") || cmd.includes("doc")
            ? "document"
            : "overview";
      pivotTo("candidates", "sarah-chen", "Sarah Chen", lens);
    } else if (cmd.includes("revenue")) {
      pivotTo("revenue", "global-revenue", "Revenue · QTD", "grid");
    } else if (cmd.includes("aberdeen") || cmd.includes("company")) {
      pivotTo("companies", "aberdeen", "Aberdeen Health", "overview");
    }

    setQuery("");
    setOpen(false);
  };

  const listId = useId();

  return (
    <div className="lis-omni">
      <button type="button" className="lis-omni-trigger lis-focusable" onClick={() => setOpen(true)}>
        <Icon name="search" size={13} />
        <span>Search or invoke &quot;/&quot;…</span>
        <kbd>⌘K</kbd>
      </button>

      {open && (
        <>
          <div className="lis-omni-scrim" onClick={() => setOpen(false)} />
          <form
            className="lis-omni-panel"
            onSubmit={(e) => {
              e.preventDefault();
              execute(query);
            }}
          >
            <div className="lis-omni-field">
              <Icon name="command" size={14} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command — /grid  ·  @Sarah Chen /canvas …"
                aria-label="Command"
                aria-controls={listId}
              />
            </div>
            <div className="lis-omni-list" id={listId}>
              {OMNIBAR_HINTS.map((h) => (
                <button
                  key={h.cmd}
                  type="button"
                  className="lis-omni-item"
                  onClick={() => execute(h.cmd)}
                >
                  <span className="lis-omni-cmd">{h.cmd}</span>
                  <span className="lis-omni-desc">{h.desc}</span>
                </button>
              ))}
            </div>
          </form>
        </>
      )}
    </div>
  );
}

// ── Non-destructive surface projection ───────────────────────────────────────
function SurfaceProjectionContainer({
  surfaceId,
  active,
  children,
}: {
  surfaceId: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      data-surface-projection={surfaceId}
      className={`lis-surface${active ? " active" : ""}`}
      // Hard display toggle keeps inactive surfaces mounted: scroll/focus/undo survive.
      style={{ display: active ? "block" : "none" }}
      role="tabpanel"
      aria-hidden={!active}
    >
      {children}
    </div>
  );
}

// ── Representative surface content (demonstrates the engine, incl. Pattern 2) ─
function SurfaceContent({
  surface,
  instanceId,
  label,
  object,
  onCompare,
  onToast,
}: {
  surface: CanonicalSurface;
  instanceId: string;
  label: string;
  object: EnterpriseObject;
  onCompare: (ids: string[]) => void;
  onToast: (msg: string) => void;
}) {
  if (surface === "overview") {
    return <OverviewSurface instanceId={instanceId} label={label} />;
  }

  if (surface === "grid") {
    return <LiveGrid object={object} onCompare={onCompare} onToast={onToast} />;
  }

  if (surface === "document") {
    return <DocumentSurface label={label} />;
  }

  // Polymorphic fallback for the remaining lenses.
  return (
    <div className="lis-pane lis-pane-center">
      <span className="lis-pane-ghost">
        Polymorphic sub-surface engine · {SURFACE_META[surface].label.toUpperCase()}
      </span>
    </div>
  );
}

// Overview reads the active instance live from the event-sourced store.
function OverviewSurface({ instanceId, label }: { instanceId: string; label: string }) {
  const inst = useRuntimeInstance(instanceId);
  return (
    <div className="lis-pane lis-pane-pad">
      <h2 className="lis-pane-h">{label} · Overview</h2>
      <p className="lis-pane-sub">Projected live from the append-only event log — read-only here.</p>
      {inst ? (
        <div className="lis-ov-cards">
          <div className="lis-ov-card">
            <span className="lis-ov-k">{inst.metricLabel}</span>
            <span className={`lis-ov-v t-${inst.tone}`}>
              {inst.metricValue}
              {inst.metricUnit}
            </span>
          </div>
          <div className="lis-ov-card">
            <span className="lis-ov-k">Stage</span>
            <span className="lis-ov-v">{inst.stage ?? "—"}</span>
          </div>
          <div className="lis-ov-card">
            <span className="lis-ov-k">Status</span>
            <span className="lis-ov-v">{inst.approved ? "Approved" : "In flight"}</span>
          </div>
          <div className="lis-ov-card lis-ov-card-wide">
            <span className="lis-ov-k">Tags</span>
            <span className="lis-ov-v">{inst.tags.join(" · ") || "None"}</span>
          </div>
        </div>
      ) : (
        <div className="lis-pane-card">Status: synced via Core Ledger · contract {instanceId}</div>
      )}
    </div>
  );
}

function DocumentSurface({ label }: { label: string }) {
  return (
    <div className="lis-pane lis-doc">
      <h1 className="lis-doc-h">Executive briefing · {label}</h1>
      <p className="lis-doc-p">
        Candidate demonstrates distinct capability matching for senior staffing roles within
        distributed, low-latency engineering ecosystems.
      </p>
      <p className="lis-doc-p">
        Recommended next lens:{" "}
        <InlineProjector
          baseValue="overview"
          projectedValue="AI Studio"
          status="optimistic"
          type="token-chip"
        />{" "}
        for capability synthesis.
      </p>
      <textarea
        className="lis-doc-edit"
        defaultValue="Notes persist here across lens switches — this textarea is never unmounted."
        aria-label="Briefing notes"
      />
    </div>
  );
}
