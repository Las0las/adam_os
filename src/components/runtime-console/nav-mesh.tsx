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
import { InlineProjector, type InlineStatus } from "./inline-projector";
import {
  ALL_SURFACES,
  OBJECTS,
  SURFACE_META,
  useNavStore,
  type CanonicalSurface,
} from "./nav-store";

export function NavMesh() {
  const activeObject = useNavStore((s) => s.activeObject);
  const activeLabel = useNavStore((s) => s.activeLabel);
  const activeSurface = useNavStore((s) => s.activeSurface);
  const mountedInstances = useNavStore((s) => s.mountedInstances);
  const activeId = useNavStore((s) => s.activeId);
  const setSurface = useNavStore((s) => s.setSurface);

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
              <SurfaceContent surface={surface} instanceId={activeId} label={activeLabel} />
            </SurfaceProjectionContainer>
          ))}
          <div className="lis-mesh-cachenote">
            {mountedInstances.length} instance{mountedInstances.length === 1 ? "" : "s"} cached ·{" "}
            {ALL_SURFACES.length} surfaces mounted (state preserved)
          </div>
        </main>
      </div>
    </div>
  );
}

// ── Layer 1 ──────────────────────────────────────────────────────────────────
function LeftWorkspaceRail() {
  const activeObject = useNavStore((s) => s.activeObject);
  const pivotTo = useNavStore((s) => s.pivotTo);
  return (
    <nav className="lis-rail" aria-label="Enterprise objects">
      <div className="lis-rail-mark" title="LAWRENCE">
        <Icon name="command" size={18} />
      </div>
      {OBJECTS.map((o) => {
        const active = activeObject === o.id;
        return (
          <button
            key={o.id}
            type="button"
            className={`lis-rail-btn lis-focusable${active ? " active" : ""}`}
            title={o.label}
            aria-label={o.label}
            aria-current={active ? "true" : undefined}
            onClick={() => pivotTo(o.id, o.rootId, o.rootLabel)}
          >
            <Icon name={o.icon} size={20} />
            {active && <span className="lis-rail-active" aria-hidden />}
          </button>
        );
      })}
    </nav>
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
}: {
  surface: CanonicalSurface;
  instanceId: string;
  label: string;
}) {
  if (surface === "overview") {
    return (
      <div className="lis-pane lis-pane-pad">
        <h2 className="lis-pane-h">{label} · Overview</h2>
        <p className="lis-pane-sub">Projected from the canonical graph — read-only.</p>
        <div className="lis-pane-card">Status: synced via Core Ledger · contract {instanceId}</div>
      </div>
    );
  }

  if (surface === "grid") {
    return <StreamingGrid />;
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

// Grid that demonstrates Pattern 2 ghost/optimistic streaming inline.
function StreamingGrid() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => (n + 1) % 4), 1400);
    return () => clearInterval(t);
  }, []);
  const status: InlineStatus = (["idle", "streaming", "optimistic", "idle"] as const)[tick]!;
  const rows = [
    { field: "Pipeline throughput", base: "1,420 items/sec", proj: "1,512 items/sec", delta: "+4.2%", tone: "good" },
    { field: "Skills match", base: "91%", proj: "94%", delta: "+3.0%", tone: "good" },
    { field: "Memory heap", base: "412.8 MB", proj: "412.8 MB", delta: "Stable", tone: "muted" },
  ];
  return (
    <div className="lis-pane lis-pane-pad">
      <div className="lis-grid">
        <div className="lis-grid-head">
          <span>Metric field</span>
          <span>Runtime aggregation</span>
          <span>Delta</span>
        </div>
        {rows.map((r, i) => (
          <div className="lis-grid-row" key={r.field}>
            <span>{r.field}</span>
            <span className="lis-grid-val">
              <InlineProjector
                baseValue={r.base}
                projectedValue={r.proj}
                status={i === 2 ? "idle" : status}
              />
            </span>
            <span className={`lis-grid-delta t-${r.tone}`}>{r.delta}</span>
          </div>
        ))}
      </div>
      <p className="lis-pane-sub" style={{ marginTop: 12 }}>
        Live: values stream in as ghost text, then project as a speculative diff — zero layout
        thrash. Scroll position and this ticker survive a lens switch.
      </p>
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
