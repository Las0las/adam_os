"use client";

// ─────────────────────────────────────────────────────────────────────────
// LIS-001 — LAWRENCE Interaction System · primitives
// Reusable, governance-aware interaction building blocks. Every primitive
// here makes the runtime feel executable and governed: actions show their
// intent before they run, run optimistically, and stay reversible.
// ─────────────────────────────────────────────────────────────────────────

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "./icons";

// ── Governance metadata ────────────────────────────────────────────────────

export type RiskBand = "good" | "warn" | "bad";

/** What an action/object declares about itself BEFORE it is run. */
export interface IntentMeta {
  readonly intent: string;
  readonly authority: string;
  readonly risk: { readonly tier: number; readonly label: string; readonly band: RiskBand };
  readonly evidence: readonly string[];
  readonly expected: string;
}

export type Decision = "approve" | "dismiss" | "escalate";

// ── useGovernedAction ───────────────────────────────────────────────────────
// The optimistic state-chain. A click NEVER shows a bare spinner that blocks:
//   approve   → requested → governing → granted   (reversible for a window)
//   dismiss   → requested → granted (applied)      (reversible)
//   escalate  → requested → escalated (routed)     (reversible)

export type Phase = "idle" | "requested" | "governing" | "settled";
export type Outcome = "granted" | "denied" | "escalated";

export interface GovernedState {
  readonly phase: Phase;
  readonly decision: Decision | null;
  readonly outcome: Outcome | null;
  readonly label: string;
}

const IDLE: GovernedState = { phase: "idle", decision: null, outcome: null, label: "" };

export function useGovernedAction(opts?: {
  /** called once a decision has fully settled (for toasts / audit). */
  onSettled?: (decision: Decision, outcome: Outcome) => void;
  /** called when the user reverses a settled decision inside the undo window. */
  onReverted?: (decision: Decision) => void;
}): {
  state: GovernedState;
  run: (decision: Decision) => void;
  revert: () => void;
} {
  const [state, setState] = useState<GovernedState>(IDLE);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const settledRef = useRef(opts?.onSettled);
  const revertedRef = useRef(opts?.onReverted);
  settledRef.current = opts?.onSettled;
  revertedRef.current = opts?.onReverted;

  const clear = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const run = useCallback(
    (decision: Decision) => {
      clear();
      // Instant optimistic acknowledgement — the click registers immediately.
      setState({ phase: "requested", decision, outcome: null, label: "Requested" });

      // Dismiss skips the governance gate (read-side suppression, low risk).
      if (decision === "dismiss") {
        timers.current.push(
          setTimeout(() => {
            setState({ phase: "settled", decision, outcome: "granted", label: "Dismissed" });
            settledRef.current?.(decision, "granted");
          }, 360),
        );
        return;
      }

      // Approve + escalate pass through the governance gate.
      timers.current.push(
        setTimeout(() => {
          setState({ phase: "governing", decision, outcome: null, label: "Awaiting governance" });
        }, 260),
      );
      timers.current.push(
        setTimeout(() => {
          const outcome: Outcome = decision === "escalate" ? "escalated" : "granted";
          const label = decision === "escalate" ? "Escalated to a human" : "Approved";
          setState({ phase: "settled", decision, outcome, label });
          settledRef.current?.(decision, outcome);
        }, 760),
      );
    },
    [clear],
  );

  const revert = useCallback(() => {
    clear();
    const d = state.decision;
    setState(IDLE);
    if (d) revertedRef.current?.(d);
  }, [clear, state.decision]);

  useEffect(() => () => clear(), [clear]);

  return { state, run, revert };
}

// ── GovernedActionBar ───────────────────────────────────────────────────────
// Renders the three governed buttons, then swaps to the optimistic track the
// instant a decision is made. Reversible while settled.

export function GovernedActionBar({
  onSettled,
  onReverted,
  approveLabel = "Approve",
  compact = false,
}: {
  onSettled?: (decision: Decision, outcome: Outcome) => void;
  onReverted?: (decision: Decision) => void;
  approveLabel?: string;
  compact?: boolean;
}) {
  const { state, run, revert } = useGovernedAction({ onSettled, onReverted });

  if (state.phase === "idle") {
    return (
      <div className="lis-actions">
        <button type="button" className="lis-btn approve lis-focusable" onClick={() => run("approve")}>
          <Icon name="check" size={13} /> {approveLabel}
        </button>
        {!compact && (
          <button type="button" className="lis-btn dismiss lis-focusable" onClick={() => run("dismiss")}>
            Dismiss
          </button>
        )}
        <button type="button" className="lis-btn escalate lis-focusable" onClick={() => run("escalate")}>
          <Icon name="arrow" size={12} /> Escalate
        </button>
      </div>
    );
  }

  const inFlight = state.phase === "requested" || state.phase === "governing";
  const dotClass =
    state.phase === "settled"
      ? state.outcome === "escalated"
        ? "escalated"
        : state.outcome === "denied"
          ? "denied"
          : "granted"
      : "requested";

  return (
    <div className="lis-track" role="status" aria-live="polite">
      {inFlight ? <span className="lis-track-spinner" /> : <span className={`lis-track-dot ${dotClass}`} />}
      <span className="lis-track-label">
        {state.phase === "requested" && (
          <>
            <b>Requested</b> · optimistic
          </>
        )}
        {state.phase === "governing" && (
          <>
            <b>Awaiting governance</b> · evaluating policies
          </>
        )}
        {state.phase === "settled" && <b>{state.label}</b>}
      </span>
      {state.phase === "settled" && (
        <button type="button" className="lis-undo lis-focusable" onClick={revert}>
          Undo
        </button>
      )}
    </div>
  );
}

// ── IntentPreview ────────────────────────────────────────────────────────────
// Hover (or focus) any governed surface to see intent / authority / risk /
// evidence / expected result, positioned next to the cursor target.

export function IntentPreview({ meta, children }: { meta: IntentMeta; children: ReactNode }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = 320;
    const x = Math.min(r.left, window.innerWidth - width - 16);
    const below = r.bottom + 320 < window.innerHeight;
    const y = below ? r.bottom + 8 : Math.max(16, r.top - 8 - 220);
    setPos({ x: Math.max(16, x), y });
  }, []);

  const hide = useCallback(() => {
    hideTimer.current = setTimeout(() => setPos(null), 60);
  }, []);

  useEffect(() => () => void (hideTimer.current && clearTimeout(hideTimer.current)), []);

  return (
    <span
      ref={ref}
      className="lis-intent-host"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      style={{ display: "contents" }}
    >
      {children}
      {pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="lis-preview" style={{ left: pos.x, top: pos.y }} role="tooltip">
            <div className="lis-preview-head">
              <Icon name="intent" size={14} className="t-accent" />
              <span className="lis-preview-intent">{meta.intent}</span>
            </div>
            <div className="lis-preview-grid">
              <div className="lis-preview-row">
                <span className="lis-preview-k">Authority</span>
                <span className="lis-preview-v">{meta.authority}</span>
              </div>
              <div className="lis-preview-row">
                <span className="lis-preview-k">Risk</span>
                <span className="lis-preview-v">
                  <span className={`lis-risk r-${meta.risk.band}`}>
                    <span className="dot" /> Tier {meta.risk.tier} · {meta.risk.label}
                  </span>
                </span>
              </div>
              <div className="lis-preview-row">
                <span className="lis-preview-k">Evidence</span>
                <ul className="lis-preview-ev">
                  {meta.evidence.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
              <div className="lis-preview-row">
                <span className="lis-preview-k">Expected</span>
                <span className="lis-preview-v">{meta.expected}</span>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
}

// ── Clipboard ────────────────────────────────────────────────────────────────

export function useClipboard(): (text: string) => Promise<boolean> {
  return useCallback(async (text: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      /* fall through */
    }
    return false;
  }, []);
}

// ── Context menu ──────────────────────────────────────────────────────────────

export interface MenuItem {
  readonly id: string;
  readonly label: string;
  readonly icon: IconName;
  readonly kbd?: string;
  readonly run: () => void | boolean | Promise<boolean>;
  /** flash the label green on success (used by copy items). */
  readonly flashOnRun?: boolean;
  readonly sep?: boolean;
}

interface MenuState {
  x: number;
  y: number;
  items: readonly MenuItem[];
}

const MenuCtx = createContext<{
  openMenu: (e: { clientX: number; clientY: number }, items: readonly MenuItem[]) => void;
} | null>(null);

export function useContextMenu() {
  const ctx = useContext(MenuCtx);
  if (!ctx) throw new Error("useContextMenu must be used within <LisMenuProvider>");
  return ctx;
}

export function LisMenuProvider({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  const openMenu = useCallback(
    (e: { clientX: number; clientY: number }, items: readonly MenuItem[]) => {
      const width = 200;
      const x = Math.min(e.clientX, window.innerWidth - width - 12);
      const y = Math.min(e.clientY, window.innerHeight - items.length * 38 - 24);
      setMenu({ x: Math.max(8, x), y: Math.max(8, y), items });
      setFlashId(null);
    },
    [],
  );

  const close = useCallback(() => setMenu(null), []);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu, close]);

  const activate = useCallback(
    async (item: MenuItem) => {
      const result = await item.run();
      if (item.flashOnRun && result !== false) {
        setFlashId(item.id);
        setTimeout(() => {
          setFlashId(null);
          setMenu(null);
        }, 650);
      } else {
        setMenu(null);
      }
    },
    [],
  );

  return (
    <MenuCtx.Provider value={{ openMenu }}>
      {children}
      {menu &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              style={{ position: "fixed", inset: 0, zIndex: 129 }}
              onClick={close}
              onContextMenu={(e) => {
                e.preventDefault();
                close();
              }}
            />
            <div className="lis-menu" style={{ left: menu.x, top: menu.y }} role="menu">
              {menu.items.map((item) =>
                item.sep ? (
                  <div key={item.id} className="lis-menu-sep" />
                ) : (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    className={`lis-menu-item lis-focusable${flashId === item.id ? " lis-menu-flash" : ""}`}
                    onClick={() => void activate(item)}
                  >
                    <span className="lis-menu-ico">
                      <Icon name={flashId === item.id ? "check" : item.icon} size={14} />
                    </span>
                    {flashId === item.id ? "Copied" : item.label}
                    {item.kbd && <span className="lis-menu-kbd">{item.kbd}</span>}
                  </button>
                ),
              )}
            </div>
          </>,
          document.body,
        )}
    </MenuCtx.Provider>
  );
}

/** Wrap any object surface to give it a right-click governed context menu. */
export function ContextZone({
  items,
  children,
  className,
}: {
  items: readonly MenuItem[];
  children: ReactNode;
  className?: string;
}) {
  const { openMenu } = useContextMenu();
  return (
    // display:contents so the zone adds no layout box — events still bubble
    // through the DOM, so right-click works without disturbing flex/grid.
    <div
      className={`lis-ctx${className ? ` ${className}` : ""}`}
      style={{ display: "contents" }}
      onContextMenu={(e) => {
        e.preventDefault();
        openMenu(e, items);
      }}
    >
      {children}
    </div>
  );
}
