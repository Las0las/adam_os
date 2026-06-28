"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "./runtime-console.css";
import "./lis.css";
import { Icon } from "./icons";
import { LisMenuProvider } from "./lis";
import { LeftRail } from "./LeftRail";
import { CenterStage } from "./CenterStage";
import { RightRail } from "./RightRail";
import { StatusFooter } from "./StatusFooter";
import { CommandPalette } from "./CommandPalette";
import { UniversalWorkspace } from "./UniversalWorkspace";
import { PIPELINE, SCOPES, type Scope } from "@/lib/runtime-console/data";

const IDLE_ACTIVE = PIPELINE.findIndex((s) => s.key === "runtime");

function LawrenceMark() {
  return (
    <svg width="40" height="40" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="M24 3 42 13.5v21L24 45 6 34.5v-21L24 3Z"
        stroke="#44b0b1"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M18 16v16h12" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 24h7" stroke="#44b0b1" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function RuntimeConsole() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [openObjectId, setOpenObjectId] = useState<string | null>(null);
  const [scopeIdx, setScopeIdx] = useState(0);
  const [executing, setExecuting] = useState(false);
  const [doneThrough, setDoneThrough] = useState(0);
  const [activeIndex, setActiveIndex] = useState(IDLE_ACTIVE);
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scope: Scope = SCOPES[scopeIdx] ?? SCOPES[0];

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const execute = useCallback(() => {
    if (executing) return;
    setExecuting(true);
    setDoneThrough(0);
    setActiveIndex(0);
    let step = 0;
    timer.current = setInterval(() => {
      step += 1;
      if (step >= PIPELINE.length) {
        if (timer.current) clearInterval(timer.current);
        setDoneThrough(PIPELINE.length);
        setActiveIndex(-1);
        setExecuting(false);
        showToast("Execution complete · 94% confidence");
        // settle back to the preview state after the result is acknowledged
        setTimeout(() => {
          setDoneThrough(0);
          setActiveIndex(IDLE_ACTIVE);
        }, 2600);
      } else {
        setDoneThrough(step);
        setActiveIndex(step);
      }
    }, 420);
  }, [executing, showToast]);

  // ⌘K / Ctrl+K toggles the command palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const openObject = useCallback((id: string) => setOpenObjectId(id), []);

  return (
    <LisMenuProvider>
    <div className="eor">
      <div className="eor-inner">
        {/* ── Top bar ──────────────────────────────────────────────────── */}
        <header className="eor-top">
          <div>
            <button className="eor-ws" type="button">
              <span className="eor-ws-badge">A</span>
              <span style={{ textAlign: "left" }}>
                <span className="eor-ws-name">Aberdeen Recruiting</span>
                <br />
                <span className="eor-ws-sub">Workspace</span>
              </span>
              <span className="chev">
                <Icon name="chevron" size={15} />
              </span>
            </button>
          </div>

          <div className="eor-brand">
            <div className="eor-brand-row">
              <LawrenceMark />
              <span className="eor-wordmark">LAWRENCE</span>
            </div>
            <span className="eor-brand-sub">Enterprise Object Runtime</span>
            <span className="eor-tagline">One prompt. Every object. Governed execution.</span>
          </div>

          <div className="eor-top-right">
            <button className="eor-cmdbtn" type="button" onClick={() => setPaletteOpen(true)}>
              <span className="eor-kbd">
                <Icon name="command" size={11} /> K
              </span>
              Open Command
            </button>
            <button className="eor-iconbtn" type="button" aria-label="Notifications">
              <Icon name="bell" size={18} />
              <span className="eor-badge-count">3</span>
            </button>
            <span className="eor-avatar">
              AP
              <span className="status" />
            </span>
          </div>
        </header>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <div className="eor-body">
          <LeftRail
            activeId={openObjectId}
            onOpenObject={openObject}
            onOpenPalette={() => setPaletteOpen(true)}
            onToast={showToast}
          />
          <CenterStage
            activeIndex={activeIndex}
            doneThrough={doneThrough}
            executing={executing}
            onExecute={execute}
            onOpenObject={openObject}
            onToast={showToast}
          />
          <RightRail />
        </div>
      </div>

      <StatusFooter scope={scope} onCycleScope={() => setScopeIdx((i) => (i + 1) % SCOPES.length)} />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onOpenObject={openObject}
        onRun={(label) => showToast(`${label} — queued`)}
      />
      <UniversalWorkspace objectId={openObjectId} onClose={() => setOpenObjectId(null)} />

      {toast && (
        <div className="eor-toast" role="status">
          <Icon name="check" size={16} /> {toast}
        </div>
      )}
    </div>
    </LisMenuProvider>
  );
}
