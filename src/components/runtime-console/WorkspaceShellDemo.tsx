"use client";

/* LIS-002 demo — exercises the Canvas vs. Shelf shell: posture switching,
   overlay vs flex containment, drag-resize, and useLayoutMemory persistence. */

import { useState } from "react";
import {
  WorkspaceShell,
  useLayoutMemory,
  type ShellMode,
  type ViewportLayoutState,
} from "./lis-shell";
import "./lis-shell-demo.css";

const RAIL_ITEMS = [
  "Candidates",
  "Jobs",
  "Companies",
  "Interviews",
  "Offers",
  "Placements",
  "Workflows",
  "Policies",
];

function setShellMode(mode: ShellMode) {
  window.dispatchEvent(new CustomEvent<ShellMode>("lis-shell:set-mode", { detail: mode }));
}

export function WorkspaceShellDemo() {
  const { initialState, onLayoutChange, clear } = useLayoutMemory(
    "lis.shell.demo.v1",
    "expanded-flex",
  );
  const [last, setLast] = useState<ViewportLayoutState>(initialState);

  return (
    <div className="lis-demo">
      <header className="lis-demo-top">
        <div className="lis-demo-brand">
          <span className="lis-demo-mark">LIS-002</span>
          <span className="lis-demo-title">Canvas vs. Shelf — Workspace Shell</span>
        </div>
        <div className="lis-demo-controls">
          <span className="lis-demo-pill" data-on={last.mode === "overlay"}>
            <button type="button" onClick={() => setShellMode("overlay")}>
              Overlay
            </button>
            <button type="button" onClick={() => setShellMode("flex")}>
              Flex
            </button>
          </span>
          <code className="lis-demo-readout">
            {last.posture} · {last.mode} · {last.viewport.width}×{last.viewport.height} ·{" "}
            <span className="lis-demo-reason">{last.reason}</span>
          </code>
          <button type="button" className="lis-demo-clear" onClick={clear}>
            Clear memory
          </button>
        </div>
      </header>

      <div className="lis-demo-stage">
        <WorkspaceShell
          layoutState={initialState.posture}
          initialState={initialState}
          onLayoutChange={(s) => {
            setLast(s);
            onLayoutChange(s);
          }}
          leftLabel="Navigation"
          rightLabel="Inspector"
          bottomLabel="Terminal"
          leftRail={
            <nav className="lis-demo-nav">
              <p className="lis-demo-eyebrow">Enterprise Objects</p>
              {RAIL_ITEMS.map((it) => (
                <button type="button" key={it} className="lis-demo-navitem">
                  {it}
                </button>
              ))}
            </nav>
          }
          rightInspector={
            <div className="lis-demo-inspector">
              <p className="lis-demo-eyebrow">Inspector</p>
              <div className="lis-demo-field">
                <span>Object</span>
                <strong>Sarah Chen</strong>
              </div>
              <div className="lis-demo-field">
                <span>Authority</span>
                <strong>Read-only projection</strong>
              </div>
              <div className="lis-demo-field">
                <span>Risk tier</span>
                <strong>0 · No mutation</strong>
              </div>
              <div className="lis-demo-field">
                <span>Confidence</span>
                <strong>94% High</strong>
              </div>
            </div>
          }
          bottomTerminal={
            <div className="lis-demo-terminal">
              <p>
                <span className="lis-demo-prompt">lawrence&gt;</span> resolve candidate sarah-chen
                --against jr-118
              </p>
              <p className="lis-demo-dim">↳ projection ready · 42 sources · 21ms · no mutation</p>
              <p>
                <span className="lis-demo-prompt">lawrence&gt;</span> _
              </p>
            </div>
          }
          canvas={
            <div className="lis-demo-canvas">
              <p className="lis-demo-eyebrow">Canvas — Active Workspace</p>
              <h1>Compare Sarah Chen against JR-118</h1>
              <p className="lis-demo-lead">
                The canvas owns the viewport. Rails collapse to a 40px icon shelf; expand them as an
                overlay (floats, no reflow) or in flex (tracks grow, hard containment).
              </p>
              <div className="lis-demo-grid">
                {["Skills Match", "Experience", "Cultural Fit", "Compensation", "Risk", "Confidence"].map(
                  (c) => (
                    <div className="lis-demo-card" key={c}>
                      <span>{c}</span>
                    </div>
                  ),
                )}
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
}
