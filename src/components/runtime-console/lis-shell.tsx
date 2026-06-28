"use client";

/* ───────────────────────────────────────────────────────────────────────────
   LIS-002 — Canvas vs. Shelf layout shell
   WorkspaceShell: the Canvas owns the viewport; the Shelf (left rail, right
   inspector, bottom terminal) keeps a 40px icon-only baseline and expands as
   an OVERLAY (floats over the canvas, no reflow) or in FLEX (grid tracks grow
   with hard overflow containment). Emits viewport payloads on toggle / drag /
   resize / mode for useLayoutMemory to persist.
   ─────────────────────────────────────────────────────────────────────────── */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import "./lis-shell.css";

export type ShellMode = "overlay" | "flex";
export type LayoutPosture = "minimized" | "expanded-overlay" | "expanded-flex";
export type PanelKey = "left" | "right" | "bottom";
export type LayoutReason = "init" | "toggle" | "drag" | "resize" | "mode";

export interface PanelState {
  readonly open: boolean;
  readonly size: number;
}

export interface ViewportLayoutState {
  readonly mode: ShellMode;
  readonly posture: LayoutPosture;
  readonly panels: Record<PanelKey, PanelState>;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly reason: LayoutReason;
  readonly ts: number;
}

export interface WorkspaceShellProps {
  canvas: ReactNode;
  leftRail?: ReactNode;
  rightInspector?: ReactNode;
  bottomTerminal?: ReactNode;
  /** Declared posture; sets the default mode + which panels start open. */
  layoutState: LayoutPosture;
  /** Hydrate from persisted memory (wins over layoutState when present). */
  initialState?: ViewportLayoutState;
  /** Emitted on every toggle / drag / resize / mode change. */
  onLayoutChange?: (state: ViewportLayoutState) => void;
  leftLabel?: string;
  rightLabel?: string;
  bottomLabel?: string;
}

const DEFAULT_SIZE: Record<PanelKey, number> = { left: 264, right: 340, bottom: 220 };
const MIN_SIZE: Record<PanelKey, number> = { left: 200, right: 260, bottom: 140 };
const MAX_SIZE: Record<PanelKey, number> = { left: 460, right: 560, bottom: 440 };

const clampSize = (key: PanelKey, n: number): number =>
  Math.max(MIN_SIZE[key], Math.min(MAX_SIZE[key], Math.round(n)));

interface InternalState {
  mode: ShellMode;
  open: Record<PanelKey, boolean>;
  size: Record<PanelKey, number>;
}

function fromPosture(posture: LayoutPosture): InternalState {
  const mode: ShellMode = posture === "expanded-overlay" ? "overlay" : "flex";
  // "expanded-*" opens the side rails; the terminal stays user-toggled.
  const opened = posture !== "minimized";
  return {
    mode,
    open: { left: opened, right: opened, bottom: false },
    size: { ...DEFAULT_SIZE },
  };
}

function fromViewport(v: ViewportLayoutState): InternalState {
  return {
    mode: v.mode,
    open: { left: v.panels.left.open, right: v.panels.right.open, bottom: v.panels.bottom.open },
    size: {
      left: clampSize("left", v.panels.left.size),
      right: clampSize("right", v.panels.right.size),
      bottom: clampSize("bottom", v.panels.bottom.size),
    },
  };
}

function postureOf(mode: ShellMode, open: Record<PanelKey, boolean>): LayoutPosture {
  if (!open.left && !open.right && !open.bottom) return "minimized";
  return mode === "overlay" ? "expanded-overlay" : "expanded-flex";
}

export function WorkspaceShell({
  canvas,
  leftRail,
  rightInspector,
  bottomTerminal,
  layoutState,
  initialState,
  onLayoutChange,
  leftLabel = "Navigation",
  rightLabel = "Inspector",
  bottomLabel = "Terminal",
}: WorkspaceShellProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<InternalState>(() =>
    initialState ? fromViewport(initialState) : fromPosture(layoutState),
  );
  const [dragging, setDragging] = useState<PanelKey | null>(null);

  // Single emit path: build the serializable payload from the latest state.
  const emit = useCallback(
    (next: InternalState, reason: LayoutReason) => {
      const el = shellRef.current;
      const width = el?.clientWidth ?? 0;
      const height = el?.clientHeight ?? 0;
      onLayoutChange?.({
        mode: next.mode,
        posture: postureOf(next.mode, next.open),
        panels: {
          left: { open: next.open.left, size: next.size.left },
          right: { open: next.open.right, size: next.size.right },
          bottom: { open: next.open.bottom, size: next.size.bottom },
        },
        viewport: { width, height },
        reason,
        ts: Date.now(),
      });
    },
    [onLayoutChange],
  );

  const togglePanel = useCallback(
    (key: PanelKey) => {
      setState((prev) => {
        const next = { ...prev, open: { ...prev.open, [key]: !prev.open[key] } };
        emit(next, "toggle");
        return next;
      });
    },
    [emit],
  );

  const setMode = useCallback(
    (mode: ShellMode) => {
      setState((prev) => {
        const next = { ...prev, mode };
        emit(next, "mode");
        return next;
      });
    },
    [emit],
  );

  const closeAll = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, open: { left: false, right: false, bottom: false } };
      emit(next, "toggle");
      return next;
    });
  }, [emit]);

  // ── Drag-to-resize ─────────────────────────────────────────────────────────
  const dragInfo = useRef<{ key: PanelKey; start: number; startSize: number } | null>(null);

  const onResizeDown = useCallback(
    (key: PanelKey) => (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      dragInfo.current = {
        key,
        start: key === "bottom" ? e.clientY : e.clientX,
        startSize: state.size[key],
      };
      setDragging(key);
    },
    [state.size],
  );

  const onResizeMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const info = dragInfo.current;
    if (!info) return;
    const pos = info.key === "bottom" ? e.clientY : e.clientX;
    let delta = pos - info.start;
    // left grows rightward (+); right & bottom grow toward the canvas (−).
    if (info.key !== "left") delta = -delta;
    const size = clampSize(info.key, info.startSize + delta);
    setState((prev) => ({ ...prev, size: { ...prev.size, [info.key]: size } }));
  }, []);

  const onResizeUp = useCallback(() => {
    const info = dragInfo.current;
    dragInfo.current = null;
    setDragging(null);
    if (info) {
      setState((prev) => {
        emit(prev, "drag");
        return prev;
      });
    }
  }, [emit]);

  // ── Viewport resize → emit (debounced via rAF) ─────────────────────────────
  useEffect(() => {
    const el = shellRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setState((prev) => {
          emit(prev, "resize");
          return prev;
        });
      });
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [emit]);

  // Escape closes overlay panels (canvas stays put underneath).
  useEffect(() => {
    if (state.mode !== "overlay") return;
    const anyOpen = state.open.left || state.open.right || state.open.bottom;
    if (!anyOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.mode, state.open, closeAll]);

  const isOverlay = state.mode === "overlay";
  const anyOpen = state.open.left || state.open.right || state.open.bottom;

  // Grid tracks: in flex, an open rail grows the track (strip 40 + panel).
  // In overlay the track stays 40px so the floating panel never shifts canvas.
  const trackLeft = !isOverlay && state.open.left ? 40 + state.size.left : 40;
  const trackRight = !isOverlay && state.open.right ? 40 + state.size.right : 40;
  const trackBottom = !isOverlay && state.open.bottom ? 40 + state.size.bottom : 40;

  const style = useMemo<CSSProperties>(
    () =>
      ({
        "--lis-lc": `${trackLeft}px`,
        "--lis-rc": `${trackRight}px`,
        "--lis-br": `${trackBottom}px`,
        "--lis-l-size": `${state.size.left}px`,
        "--lis-r-size": `${state.size.right}px`,
        "--lis-b-size": `${state.size.bottom}px`,
      }) as CSSProperties,
    [trackLeft, trackRight, trackBottom, state.size],
  );

  return (
    <div
      ref={shellRef}
      className="lis-shell"
      data-mode={state.mode}
      data-dragging={dragging ? "true" : "false"}
      style={style}
      onPointerMove={dragging ? onResizeMove : undefined}
      onPointerUp={dragging ? onResizeUp : undefined}
    >
      {leftRail && (
        <div className="lis-rail lis-rail-left" data-open={state.open.left} data-overlay={isOverlay}>
          <div className="lis-strip">
            <button
              type="button"
              className="lis-strip-btn"
              data-active={state.open.left}
              aria-label={`${state.open.left ? "Collapse" : "Expand"} ${leftLabel}`}
              aria-expanded={state.open.left}
              onClick={() => togglePanel("left")}
              title={leftLabel}
            >
              <GlyphPanelSide side="left" />
            </button>
            <span className="lis-strip-spacer" />
            {state.open.left && <span className="lis-strip-tick" />}
          </div>
          <div className="lis-panel lis-panel-left">
            <div className="lis-panel-inner">{leftRail}</div>
            <div
              className="lis-resize lis-resize-x"
              data-dragging={dragging === "left"}
              onPointerDown={onResizeDown("left")}
              role="separator"
              aria-orientation="vertical"
              aria-label={`Resize ${leftLabel}`}
            />
          </div>
        </div>
      )}

      <main className="lis-canvas" aria-label="Active workspace canvas">
        <div className="lis-canvas-frame">{canvas}</div>
      </main>

      {rightInspector && (
        <div
          className="lis-rail lis-rail-right"
          data-open={state.open.right}
          data-overlay={isOverlay}
        >
          <div className="lis-strip">
            <button
              type="button"
              className="lis-strip-btn"
              data-active={state.open.right}
              aria-label={`${state.open.right ? "Collapse" : "Expand"} ${rightLabel}`}
              aria-expanded={state.open.right}
              onClick={() => togglePanel("right")}
              title={rightLabel}
            >
              <GlyphPanelSide side="right" />
            </button>
            <span className="lis-strip-spacer" />
            {state.open.right && <span className="lis-strip-tick" />}
          </div>
          <div className="lis-panel lis-panel-right">
            <div className="lis-panel-inner">{rightInspector}</div>
            <div
              className="lis-resize lis-resize-x"
              data-dragging={dragging === "right"}
              onPointerDown={onResizeDown("right")}
              role="separator"
              aria-orientation="vertical"
              aria-label={`Resize ${rightLabel}`}
            />
          </div>
        </div>
      )}

      {bottomTerminal && (
        <div
          className="lis-rail lis-rail-bottom"
          data-open={state.open.bottom}
          data-overlay={isOverlay}
        >
          <div className="lis-bar">
            <button
              type="button"
              className="lis-strip-btn"
              data-active={state.open.bottom}
              aria-label={`${state.open.bottom ? "Collapse" : "Expand"} ${bottomLabel}`}
              aria-expanded={state.open.bottom}
              onClick={() => togglePanel("bottom")}
              title={bottomLabel}
            >
              <GlyphPanelBottom />
            </button>
            <span className="lis-bar-title">{bottomLabel}</span>
          </div>
          <div className="lis-panel lis-panel-bottom">
            <div className="lis-panel-inner">{bottomTerminal}</div>
            <div
              className="lis-resize lis-resize-y"
              data-dragging={dragging === "bottom"}
              onPointerDown={onResizeDown("bottom")}
              role="separator"
              aria-orientation="horizontal"
              aria-label={`Resize ${bottomLabel}`}
            />
          </div>
        </div>
      )}

      {/* Overlay scrim: dims canvas, click-to-close, never reflows it. */}
      {isOverlay && anyOpen && (
        <button
          type="button"
          className="lis-scrim"
          aria-label="Close panels"
          onClick={closeAll}
        />
      )}

      {/* expose mode control to consumers via a custom event hook point */}
      <ShellModeBridge mode={state.mode} setMode={setMode} />
    </div>
  );
}

/* A tiny imperative bridge so a parent can flip overlay/flex without prop drilling:
   dispatch `window` CustomEvent("lis-shell:set-mode", {detail:"overlay"|"flex"}). */
function ShellModeBridge({
  mode,
  setMode,
}: {
  mode: ShellMode;
  setMode: (m: ShellMode) => void;
}) {
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ShellMode>).detail;
      if ((detail === "overlay" || detail === "flex") && detail !== mode) setMode(detail);
    };
    window.addEventListener("lis-shell:set-mode", handler);
    return () => window.removeEventListener("lis-shell:set-mode", handler);
  }, [mode, setMode]);
  return null;
}

// ── useLayoutMemory ──────────────────────────────────────────────────────────
// Consumes the shell's viewport payloads and persists them (localStorage).
// Returns the hydrated initial state + the onLayoutChange sink to wire in.
export function useLayoutMemory(
  storageKey: string,
  fallbackPosture: LayoutPosture = "expanded-flex",
): {
  initialState: ViewportLayoutState;
  onLayoutChange: (s: ViewportLayoutState) => void;
  clear: () => void;
} {
  const seedFromPosture = useCallback((): ViewportLayoutState => {
    const s = fromPosture(fallbackPosture);
    return {
      mode: s.mode,
      posture: fallbackPosture,
      panels: {
        left: { open: s.open.left, size: s.size.left },
        right: { open: s.open.right, size: s.size.right },
        bottom: { open: s.open.bottom, size: s.size.bottom },
      },
      viewport: { width: 0, height: 0 },
      reason: "init",
      ts: Date.now(),
    };
  }, [fallbackPosture]);

  const [initialState] = useState<ViewportLayoutState>(() => {
    if (typeof window === "undefined") return seedFromPosture();
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return seedFromPosture();
      const parsed = JSON.parse(raw) as ViewportLayoutState;
      if (parsed && parsed.panels && parsed.mode) return parsed;
    } catch {
      /* corrupt payload → fall back */
    }
    return seedFromPosture();
  });

  const onLayoutChange = useCallback(
    (s: ViewportLayoutState) => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(s));
      } catch {
        /* storage full / blocked — non-fatal */
      }
    },
    [storageKey],
  );

  const clear = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  return { initialState, onLayoutChange, clear };
}

// ── Inline glyphs (self-contained, no icon-name coupling) ────────────────────
function GlyphPanelSide({ side }: { side: "left" | "right" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <line
        x1={side === "left" ? "9" : "15"}
        y1="4"
        x2={side === "left" ? "9" : "15"}
        y2="20"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function GlyphPanelBottom() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <line x1="3" y1="15" x2="21" y2="15" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
