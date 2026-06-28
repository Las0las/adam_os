"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

export interface PrimerMetrics {
  runtimeCount: number;
  runtimeGraphHash: string;
  conformant: boolean;
  conformanceChecks: number;
  conformanceFailing: number;
  constitutionVersion: string;
  reconstructable: boolean;
  stateRootHash: string;
  canonicalSources: number;
  replayDeterministic: boolean;
  replayFingerprint: string;
  blockingRisks: number;
}

const TOTAL = 12;

/* ----------------------------------------------------------------------------
 * Dot-matrix halftone — the Palantir Learn brand motif. Deterministic radial
 * field; three variants vary density + falloff. Decorative but on-brand.
 * ------------------------------------------------------------------------- */
function DotMatrix({ variant }: { variant: "ring" | "dense" | "cluster" }) {
  const size = 240;
  const c = size / 2;
  const dots: { x: number; y: number; r: number }[] = [];
  const rings = 13;
  for (let ring = 1; ring <= rings; ring++) {
    const radius = (ring / rings) * (c - 8);
    const count = Math.max(6, Math.round(ring * 5));
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + ring * 0.18;
      const t = ring / rings;
      let r: number;
      if (variant === "ring") r = 1.1 + (1 - t) * 2.6;
      else if (variant === "dense") r = 1.3 + (1 - Math.abs(t - 0.32)) * 3.2;
      else r = 0.8 + Math.pow(1 - t, 1.8) * 5.2;
      dots.push({ x: c + Math.cos(a) * radius, y: c + Math.sin(a) * radius, r: Math.max(0.6, r) });
    }
  }
  return (
    <svg className="pr-dots" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} />
      ))}
    </svg>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="pr-mono-label">{children}</span>;
}

export function PrimerDeck({ metrics }: { metrics: PrimerMetrics }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLElement | null)[]>([]);
  const [active, setActive] = useState(0);

  const goTo = useCallback((i: number) => {
    const clamped = Math.max(0, Math.min(TOTAL - 1, i));
    slideRefs.current[clamped]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Track the active slide via intersection within the deck scroller.
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const idx = Number((e.target as HTMLElement).dataset.idx);
            if (!Number.isNaN(idx)) setActive(idx);
          }
        }
      },
      { root, threshold: 0.55 },
    );
    slideRefs.current.forEach((s) => s && obs.observe(s));
    return () => obs.disconnect();
  }, []);

  // Keyboard navigation — arrows / page keys move between slides.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (["ArrowDown", "ArrowRight", "PageDown"].includes(e.key)) {
        e.preventDefault();
        goTo(active + 1);
      } else if (["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        goTo(active - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        goTo(0);
      } else if (e.key === "End") {
        e.preventDefault();
        goTo(TOTAL - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, goTo]);

  const reg = (i: number) => (el: HTMLElement | null) => {
    slideRefs.current[i] = el;
  };

  return (
    <div className="pr-root">
      <style>{CSS}</style>

      {/* Fixed chrome */}
      <header className="pr-bar">
        <div className="pr-bar-left">
          <span className="pr-mark" aria-hidden="true">L</span>
          <span className="pr-bar-title">LAWRENCE</span>
          <span className="pr-bar-sep">/</span>
          <span className="pr-bar-sub">ARCHITECTURE PRIMER</span>
        </div>
        <div className="pr-bar-right">
          <span className="pr-counter">
            {String(active + 1).padStart(2, "0")} <span className="pr-counter-dim">/ {TOTAL}</span>
          </span>
          <button type="button" className="pr-print" onClick={() => window.print()}>
            ↧ PRINT / PDF
          </button>
        </div>
      </header>

      {/* Slide rail */}
      <nav className="pr-rail" aria-label="Slides">
        {Array.from({ length: TOTAL }).map((_, i) => (
          <button
            key={i}
            type="button"
            className={`pr-rail-dot${i === active ? " on" : ""}`}
            aria-label={`Go to slide ${i + 1}`}
            aria-current={i === active}
            onClick={() => goTo(i)}
          />
        ))}
      </nav>

      <div className="pr-deck" ref={scrollerRef}>
        {/* 01 — COVER */}
        <section className="pr-slide pr-cover" data-idx={0} ref={reg(0)} aria-label="Cover">
          <div className="pr-cover-grid">
            <div className="pr-cover-main">
              <Mono>OFFICE OF THE CHIEF ARCHITECT · JUNE 28 2026</Mono>
              <h1 className="pr-cover-title">LAWRENCE</h1>
              <p className="pr-cover-tag">Constitutional Enterprise Operating System</p>
              <div className="pr-meta">
                <div>
                  <Mono>TO</Mono>
                  <p>Executive Review — CIO, CTO, Enterprise Architecture, Investment Committee</p>
                </div>
                <div>
                  <Mono>RE</Mono>
                  <p>LAWRENCE Platform — Architecture Primer</p>
                </div>
              </div>
              <Mono>12 SLIDES · ≈5 MINUTES · ↓ SCROLL OR USE ARROW KEYS</Mono>
            </div>
            <div className="pr-cover-art">
              <DotMatrix variant="ring" />
            </div>
          </div>
        </section>

        {/* 02 — THESIS */}
        <section className="pr-slide" data-idx={1} ref={reg(1)} aria-label="The position">
          <div className="pr-slide-inner">
            <Mono>01 — THE POSITION</Mono>
            <h2 className="pr-huge">
              ONE RUNTIME<br />FOR THE ENTIRE<br />ENTERPRISE.
            </h2>
            <div className="pr-body-cols">
              <p>
                Enterprise software has fragmented into hundreds of pages, modules, and disconnected
                applications — each re-implementing the same patterns and bolting governance on afterward.
                LAWRENCE takes the opposite position: a single governed runtime that every domain shares.
              </p>
              <p className="pr-pull">
                Every screen, action, and report is a projection of one governed object model.
              </p>
            </div>
          </div>
        </section>

        {/* 03 — FOUR SYSTEMS */}
        <section className="pr-slide" data-idx={2} ref={reg(2)} aria-label="The platform in four systems">
          <div className="pr-slide-inner">
            <Mono>02 — THE PLATFORM</Mono>
            <h2 className="pr-head">THE PLATFORM IN FOUR SYSTEMS</h2>
            <div className="pr-four">
              {[
                ["01", "Enterprise Ontology", "Defines enterprise reality."],
                ["02", "Enterprise Runtime", "Executes enterprise work."],
                ["03", "Platform Builder", "Builds & evolves LAWRENCE."],
                ["04", "Universal Workspace", "Where every role works."],
              ].map(([n, t, d]) => (
                <article key={n} className="pr-four-card">
                  <span className="pr-four-n">{n}</span>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 04 — SYSTEM 1 */}
        <section className="pr-slide" data-idx={3} ref={reg(3)} aria-label="Enterprise Ontology">
          <div className="pr-slide-inner pr-split">
            <div>
              <Mono>03 — SYSTEM 01</Mono>
              <h2 className="pr-head">ENTERPRISE ONTOLOGY</h2>
              <p className="pr-tag-line">Defines enterprise reality.</p>
              <p className="pr-body">
                One <strong>EnterpriseObjectDefinition</strong> is the single source of truth for a concept —
                its fields, lifecycle, policy, and evidence. ATS, CRM, and HRIS concepts are not separate
                systems; they are projections of the same governed object.
              </p>
            </div>
            <ul className="pr-feature-list">
              <li><Mono>FIELDS</Mono><span>Typed, validated, versioned</span></li>
              <li><Mono>LIFECYCLE</Mono><span>Explicit governed state machine</span></li>
              <li><Mono>POLICY</Mono><span>Permission & approval at the object</span></li>
              <li><Mono>EVIDENCE</Mono><span>Every value traces to its source</span></li>
            </ul>
          </div>
        </section>

        {/* 05 — SYSTEM 2 */}
        <section className="pr-slide" data-idx={4} ref={reg(4)} aria-label="Enterprise Runtime">
          <div className="pr-slide-inner">
            <Mono>04 — SYSTEM 02</Mono>
            <h2 className="pr-head">ENTERPRISE RUNTIME</h2>
            <p className="pr-tag-line">Executes enterprise work. Every behavior flows through the kernel.</p>
            <div className="pr-pipeline">
              {[
                "Context", "Intent", "Authority", "Decision", "Scheduler", "Workflow",
                "State", "Event", "Evidence", "Projection", "Composition", "Workspace",
              ].map((step, i) => (
                <span key={step} className="pr-pipe-step">
                  <span className="pr-pipe-i">{String(i + 1).padStart(2, "0")}</span>
                  {step}
                </span>
              ))}
            </div>
            <p className="pr-body">
              No backdoors: a human and an AI agent take the identical path. Authority is asserted, a decision
              is composed, the journal records it — then, and only then, work executes.
            </p>
          </div>
        </section>

        {/* 06 — SYSTEM 3 */}
        <section className="pr-slide" data-idx={5} ref={reg(5)} aria-label="Platform Builder">
          <div className="pr-slide-inner pr-split">
            <div>
              <Mono>05 — SYSTEM 03</Mono>
              <h2 className="pr-head">PLATFORM BUILDER</h2>
              <p className="pr-tag-line">Builds & evolves LAWRENCE.</p>
              <p className="pr-body">
                New domains are <strong>configuration, not new software</strong>. Agents author declarative DSL
                behind a constitutional compiler that validates every definition before it can run — never
                unchecked UI code.
              </p>
            </div>
            <div className="pr-callout">
              <Mono>AI-SAFE EXTENSIBILITY</Mono>
              <p>
                The compiler is the gate. A definition that fails constitutional validation does not deploy,
                whether it was written by a person or generated by a model.
              </p>
            </div>
          </div>
        </section>

        {/* 07 — SYSTEM 4 */}
        <section className="pr-slide" data-idx={6} ref={reg(6)} aria-label="Universal Workspace">
          <div className="pr-slide-inner">
            <Mono>06 — SYSTEM 04</Mono>
            <h2 className="pr-head">UNIVERSAL WORKSPACE</h2>
            <p className="pr-tag-line">Where every role works.</p>
            <p className="pr-body pr-narrow">
              One object resolves into a serializable <strong>RenderPlan</strong> that renders identically as a
              modal, a drawer, or a full page. Surfaces never own truth — they project it.
            </p>
            <div className="pr-chips">
              <span className="pr-chip">MODAL</span>
              <span className="pr-chip">DRAWER</span>
              <span className="pr-chip">FULL PAGE</span>
              <span className="pr-chip pr-chip-dim">ONE OBJECT · ONE PLAN</span>
            </div>
          </div>
        </section>

        {/* 08 — WHY IT MATTERS */}
        <section className="pr-slide" data-idx={7} ref={reg(7)} aria-label="Why it matters">
          <div className="pr-slide-inner">
            <Mono>07 — VALUE</Mono>
            <h2 className="pr-head">WHY IT MATTERS</h2>
            <div className="pr-pillars">
              {[
                ["Consolidation", "One runtime replaces a sprawl of modules. New domains are configuration, not new software."],
                ["Governance by construction", "Policy, evidence, and audit are stages of execution — never a separate compliance layer."],
                ["Reactive & precise", "A change patches only what depends on it. Surfaces never rebuild wholesale."],
                ["AI-safe extensibility", "Agents author declarative DSL behind a constitutional compiler, not unchecked code."],
              ].map(([t, d], i) => (
                <article key={t} className="pr-pillar">
                  <span className="pr-pillar-n">{String(i + 1).padStart(2, "0")}</span>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 09 — GOVERNANCE */}
        <section className="pr-slide" data-idx={8} ref={reg(8)} aria-label="Governance by construction">
          <div className="pr-slide-inner">
            <Mono>08 — THE KERNEL</Mono>
            <h2 className="pr-head">GOVERNANCE BY CONSTRUCTION</h2>
            <div className="pr-gov-chain">
              <div className="pr-gov-step"><Mono>AUTHORITY</Mono><p>May this happen?</p></div>
              <span className="pr-gov-arrow" aria-hidden="true">→</span>
              <div className="pr-gov-step"><Mono>DECISION</Mono><p>Exactly what will happen?</p></div>
              <span className="pr-gov-arrow" aria-hidden="true">→</span>
              <div className="pr-gov-step"><Mono>JOURNAL</Mono><p>Append-only, replayable record</p></div>
            </div>
            <div className="pr-stat-strip">
              <div className="pr-stat">
                <span className={`pr-stat-v ${metrics.conformant ? "ok" : "no"}`}>
                  {metrics.conformant ? "CONFORMANT" : "NON-CONFORMANT"}
                </span>
                <Mono>CONSTITUTIONAL VALIDATION · LIVE</Mono>
              </div>
              <div className="pr-stat">
                <span className="pr-stat-v">{metrics.runtimeCount} · {metrics.conformanceChecks} · {metrics.conformanceFailing}</span>
                <Mono>RUNTIMES · CHECKS · FAILING</Mono>
              </div>
              <div className="pr-stat">
                <span className="pr-stat-v">v{metrics.constitutionVersion}</span>
                <Mono>RATIFIED CONSTITUTION</Mono>
              </div>
            </div>
          </div>
        </section>

        {/* 10 — SELF-HOSTING PROOF */}
        <section className="pr-slide" data-idx={9} ref={reg(9)} aria-label="Self-hosting proof">
          <div className="pr-slide-inner">
            <Mono>09 — SB-7 · SELF-HOSTING</Mono>
            <h2 className="pr-head">THE PLATFORM PROVES ITSELF</h2>
            <p className="pr-body pr-narrow">
              LAWRENCE reconstructs its complete executable state from five canonical sources alone — Enterprise
              Objects, Runtime Definitions, the Execution Journal, the Version Graph, and the Constitution — with
              no hidden implementation state. The proof runs live.
            </p>
            <div className="pr-stat-strip">
              <div className="pr-stat">
                <span className={`pr-stat-v ${metrics.reconstructable ? "ok" : "no"}`}>
                  {metrics.reconstructable ? "RECONSTRUCTABLE" : "NOT RECONSTRUCTABLE"}
                </span>
                <Mono>{metrics.canonicalSources} CANONICAL SOURCES · {metrics.blockingRisks} BLOCKERS</Mono>
              </div>
              <div className="pr-stat">
                <span className="pr-stat-v pr-cyan-txt">{metrics.stateRootHash}</span>
                <Mono>STATE ROOT HASH</Mono>
              </div>
              <div className="pr-stat">
                <span className={`pr-stat-v ${metrics.replayDeterministic ? "ok" : "no"}`}>
                  {metrics.replayDeterministic ? "DETERMINISTIC" : "DRIFT"}
                </span>
                <Mono>REPLAY · fp {metrics.replayFingerprint}</Mono>
              </div>
            </div>
          </div>
        </section>

        {/* 11 — WHAT EXISTS (inverted) */}
        <section className="pr-slide pr-invert" data-idx={10} ref={reg(10)} aria-label="What already exists">
          <div className="pr-slide-inner">
            <Mono>10 — STATUS</Mono>
            <h2 className="pr-head">WHAT ALREADY EXISTS — PROVEN, NOT SLIDEWARE</h2>
            <ul className="pr-tech-list">
              {[
                ["RK", "Runtime Kernel Spec", "Authority, decisions, journal, snapshots", "LIVE", "dot"],
                ["ER", "Enterprise Runtime Spec", "Context → projection execution pipeline", "LIVE", "dot"],
                ["PB", "Platform Builder Spec", "Declarative DSL + constitutional compiler", "SPEC", "sq"],
                ["MH", "Multi-Host Proof", "One plan, identical across surfaces", "LIVE", "dot"],
                ["RX", "Runtime / Kernel Explorer", "Observe the kernel end to end", "LIVE", "dot"],
                ["SB", "SB-7 Self-Hosting Proof", "Reconstruct state from canon alone", "LIVE", "ring"],
              ].map(([code, title, desc, status, glyph]) => (
                <li key={code as string} className="pr-tech-row">
                  <span className="pr-tech-code">{code}</span>
                  <span className="pr-tech-title">{title}</span>
                  <span className="pr-tech-desc">{desc}</span>
                  <span className={`pr-tech-status ${status === "LIVE" ? "live" : "spec"}`}>{status}</span>
                  <span className={`pr-glyph pr-glyph-${glyph}`} aria-hidden="true" />
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 12 — CTA */}
        <section className="pr-slide pr-cta" data-idx={11} ref={reg(11)} aria-label="Get started">
          <div className="pr-slide-inner">
            <h2 className="pr-huge pr-cta-head">
              READY TO<br />GET STARTED?
            </h2>
            <div className="pr-cta-row">
              <span className="pr-cta-arrow" aria-hidden="true">→</span>
              <div className="pr-cta-links">
                <Link href="/kernel" className="pr-cta-link">Open the Runtime Explorer</Link>
                <Link href="/constitution" className="pr-cta-link pr-cta-link-ghost">Review the Constitution</Link>
              </div>
            </div>
            <div className="pr-cta-foot">
              <Mono>LAWRENCE · CONSTITUTIONAL ENTERPRISE OPERATING SYSTEM</Mono>
              <Mono>OFFICE OF THE CHIEF ARCHITECT · {new Date().getFullYear()}</Mono>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

const CSS = `
.pr-root { --pr-bg:#0b0d0e; --pr-bg2:#15191b; --pr-ink:#f3f6f5; --pr-muted:#828d8b; --pr-line:rgba(255,255,255,0.14); --pr-cyan:#8fe6d9; --pr-cyan-dim:#2e6f68;
  --pr-display:"Helvetica Neue",Helvetica,Arial,"Segoe UI",Roboto,system-ui,sans-serif;
  --pr-mono:ui-monospace,"SF Mono","Cascadia Mono","Roboto Mono",Menlo,Consolas,monospace;
  font-family: var(--pr-display); color: var(--pr-ink); background: var(--pr-bg); }
.pr-mono-label, .pr-counter, .pr-print, .pr-bar-title, .pr-bar-sub { font-family: var(--pr-mono); }

.pr-bar { position: fixed; top: 0; left: 0; right: 0; height: 46px; z-index: 40; display: flex; align-items: center; justify-content: space-between;
  padding: 0 20px; background: rgba(11,13,14,0.82); backdrop-filter: blur(8px); border-bottom: 1px solid var(--pr-line); }
.pr-bar-left { display: flex; align-items: center; gap: 10px; }
.pr-mark { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border: 1px solid var(--pr-cyan); color: var(--pr-cyan); font-weight: 800; font-size: 13px; }
.pr-bar-title { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; }
.pr-bar-sep { color: var(--pr-muted); }
.pr-bar-sub { font-size: 11px; color: var(--pr-muted); letter-spacing: 0.12em; }
.pr-bar-right { display: flex; align-items: center; gap: 16px; }
.pr-counter { font-size: 12px; letter-spacing: 0.1em; }
.pr-counter-dim { color: var(--pr-muted); }
.pr-print { background: transparent; border: 1px solid var(--pr-line); color: var(--pr-ink); font-size: 10.5px; letter-spacing: 0.1em; padding: 5px 10px; cursor: pointer; }
.pr-print:hover { border-color: var(--pr-cyan); color: var(--pr-cyan); }

.pr-rail { position: fixed; left: 16px; top: 50%; transform: translateY(-50%); z-index: 40; display: flex; flex-direction: column; gap: 10px; }
.pr-rail-dot { width: 8px; height: 8px; border-radius: 50%; border: 1px solid var(--pr-muted); background: transparent; cursor: pointer; padding: 0; transition: all 0.2s; }
.pr-rail-dot.on { background: var(--pr-cyan); border-color: var(--pr-cyan); transform: scale(1.3); }

.pr-deck { position: fixed; inset: 0; overflow-y: auto; scroll-snap-type: y mandatory; scroll-behavior: smooth; }
.pr-slide { min-height: 100vh; scroll-snap-align: start; display: flex; align-items: center; padding: 90px 72px 64px; position: relative; }
.pr-slide-inner { width: 100%; max-width: 1080px; margin: 0 auto; }

.pr-mono-label { display: inline-block; font-size: 11px; letter-spacing: 0.16em; color: var(--pr-cyan); margin-bottom: 22px; }

.pr-head { font-size: clamp(28px, 4.4vw, 54px); font-weight: 800; letter-spacing: -0.01em; line-height: 1.02; margin: 0 0 14px; text-wrap: balance; }
.pr-huge { font-size: clamp(40px, 8.4vw, 116px); font-weight: 900; letter-spacing: -0.02em; line-height: 0.92; margin: 0 0 36px; }
.pr-tag-line { font-size: clamp(15px, 1.6vw, 19px); color: var(--pr-cyan); margin: 0 0 22px; }
.pr-body, .pr-body-cols p { font-size: 15.5px; line-height: 1.62; color: #c9d1cf; max-width: 62ch; }
.pr-body strong { color: var(--pr-ink); font-weight: 700; }
.pr-narrow { max-width: 56ch; }
.pr-body-cols { display: grid; grid-template-columns: 1.4fr 1fr; gap: 40px; align-items: start; }
.pr-pull { font-family: var(--pr-display); font-size: clamp(18px,2.1vw,24px); font-weight: 600; color: var(--pr-ink); line-height: 1.3; border-left: 2px solid var(--pr-cyan); padding-left: 18px; }

/* cover */
.pr-cover-grid { width: 100%; max-width: 1180px; margin: 0 auto; display: grid; grid-template-columns: 1.5fr 1fr; gap: 48px; align-items: center; }
.pr-cover-title { font-size: clamp(56px, 11vw, 168px); font-weight: 900; letter-spacing: -0.03em; line-height: 0.9; margin: 6px 0 8px; }
.pr-cover-tag { font-size: clamp(16px, 2vw, 26px); color: var(--pr-cyan); margin: 0 0 40px; font-weight: 500; }
.pr-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 26px; margin-bottom: 36px; max-width: 720px; }
.pr-meta .pr-mono-label { margin-bottom: 8px; }
.pr-meta p { font-size: 13.5px; line-height: 1.5; color: #c9d1cf; margin: 0; }
.pr-cover-art { display: flex; justify-content: center; }
.pr-dots { width: 100%; max-width: 320px; }
.pr-dots circle { fill: var(--pr-cyan); }

/* four systems */
.pr-four { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-top: 28px; }
.pr-four-card { border: 1px solid var(--pr-line); padding: 22px 18px; min-height: 184px; display: flex; flex-direction: column; }
.pr-four-card:hover { border-color: var(--pr-cyan); }
.pr-four-n { font-family: var(--pr-mono); font-size: 12px; color: var(--pr-cyan); }
.pr-four-card h3 { font-size: 19px; font-weight: 700; margin: auto 0 8px; line-height: 1.1; }
.pr-four-card p { font-size: 13px; color: var(--pr-muted); margin: 0; }

/* split */
.pr-split { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 56px; align-items: center; }
.pr-feature-list { list-style: none; margin: 0; padding: 0; }
.pr-feature-list li { display: grid; grid-template-columns: 110px 1fr; gap: 14px; align-items: baseline; padding: 16px 0; border-top: 1px solid var(--pr-line); }
.pr-feature-list li:last-child { border-bottom: 1px solid var(--pr-line); }
.pr-feature-list .pr-mono-label { margin: 0; color: var(--pr-cyan); }
.pr-feature-list span:last-child { font-size: 14.5px; color: #c9d1cf; }

/* pipeline */
.pr-pipeline { display: flex; flex-wrap: wrap; gap: 8px; margin: 28px 0; }
.pr-pipe-step { display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--pr-line); padding: 9px 13px; font-size: 13px; font-weight: 600; }
.pr-pipe-step:hover { border-color: var(--pr-cyan); }
.pr-pipe-i { font-family: var(--pr-mono); font-size: 10px; color: var(--pr-cyan); }

/* callout */
.pr-callout { border: 1px solid var(--pr-cyan); padding: 26px; background: rgba(143,230,217,0.05); }
.pr-callout .pr-mono-label { margin-bottom: 12px; }
.pr-callout p { font-size: 15px; line-height: 1.6; color: #d4dcda; margin: 0; }

/* chips */
.pr-chips { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 30px; }
.pr-chip { font-family: var(--pr-mono); font-size: 12px; letter-spacing: 0.08em; border: 1px solid var(--pr-cyan); color: var(--pr-cyan); padding: 10px 18px; }
.pr-chip-dim { border-color: var(--pr-line); color: var(--pr-muted); }

/* pillars */
.pr-pillars { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--pr-line); margin-top: 26px; border: 1px solid var(--pr-line); }
.pr-pillar { background: var(--pr-bg); padding: 26px; }
.pr-pillar-n { font-family: var(--pr-mono); font-size: 12px; color: var(--pr-cyan); }
.pr-pillar h3 { font-size: 18px; font-weight: 700; margin: 10px 0 8px; }
.pr-pillar p { font-size: 13.5px; line-height: 1.55; color: var(--pr-muted); margin: 0; }

/* governance chain */
.pr-gov-chain { display: flex; align-items: stretch; gap: 14px; flex-wrap: wrap; margin: 30px 0; }
.pr-gov-step { flex: 1; min-width: 180px; border: 1px solid var(--pr-line); padding: 22px; }
.pr-gov-step .pr-mono-label { margin-bottom: 10px; }
.pr-gov-step p { font-size: 15px; margin: 0; color: var(--pr-ink); }
.pr-gov-arrow { display: flex; align-items: center; color: var(--pr-cyan); font-size: 22px; }

/* stat strip */
.pr-stat-strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: var(--pr-line); border: 1px solid var(--pr-line); margin-top: 26px; }
.pr-stat { background: var(--pr-bg); padding: 22px; }
.pr-stat-v { display: block; font-size: clamp(20px, 2.2vw, 30px); font-weight: 800; letter-spacing: -0.01em; margin-bottom: 10px; }
.pr-stat-v.ok { color: var(--pr-cyan); }
.pr-stat-v.no { color: #ff8a7a; }
.pr-cyan-txt { color: var(--pr-cyan); font-family: var(--pr-mono); font-weight: 700; }
.pr-stat .pr-mono-label { margin: 0; color: var(--pr-muted); }

/* inverted slide */
.pr-invert { background: #f3f6f5; color: #0b0d0e; }
.pr-invert .pr-mono-label { color: #0b8478; }
.pr-invert .pr-head { color: #0b0d0e; }
.pr-tech-list { list-style: none; margin: 24px 0 0; padding: 0; }
.pr-tech-row { display: grid; grid-template-columns: 44px 1.3fr 2fr 70px 22px; gap: 18px; align-items: center; padding: 18px 6px; border-top: 1px solid rgba(0,0,0,0.16); }
.pr-tech-row:last-child { border-bottom: 1px solid rgba(0,0,0,0.16); }
.pr-tech-code { font-family: var(--pr-mono); font-size: 12px; color: #0b8478; }
.pr-tech-title { font-size: clamp(17px,1.9vw,22px); font-weight: 700; }
.pr-tech-desc { font-size: 13px; color: #51605d; }
.pr-tech-status { font-family: var(--pr-mono); font-size: 10.5px; letter-spacing: 0.08em; padding: 4px 7px; text-align: center; }
.pr-tech-status.live { background: #0b0d0e; color: #8fe6d9; }
.pr-tech-status.spec { border: 1px solid rgba(0,0,0,0.3); color: #0b0d0e; }
.pr-glyph { width: 14px; height: 14px; justify-self: center; }
.pr-glyph-dot { border-radius: 50%; background: #0b0d0e; }
.pr-glyph-sq { background: #0b0d0e; }
.pr-glyph-ring { border-radius: 50%; border: 3px solid #0b0d0e; }

/* cta */
.pr-cta-head { color: var(--pr-ink); }
.pr-cta-row { display: flex; align-items: center; gap: 30px; margin: 20px 0 48px; flex-wrap: wrap; }
.pr-cta-arrow { font-size: clamp(40px, 6vw, 80px); color: var(--pr-cyan); line-height: 1; }
.pr-cta-links { display: flex; flex-direction: column; gap: 12px; }
.pr-cta-link { font-family: var(--pr-mono); font-size: 14px; letter-spacing: 0.04em; color: #0b0d0e; background: var(--pr-cyan); padding: 14px 22px; text-decoration: none; display: inline-block; width: fit-content; }
.pr-cta-link:hover { filter: brightness(1.08); }
.pr-cta-link-ghost { background: transparent; color: var(--pr-ink); border: 1px solid var(--pr-line); }
.pr-cta-link-ghost:hover { border-color: var(--pr-cyan); color: var(--pr-cyan); }
.pr-cta-foot { display: flex; flex-direction: column; gap: 6px; border-top: 1px solid var(--pr-line); padding-top: 20px; }
.pr-cta-foot .pr-mono-label { margin: 0; color: var(--pr-muted); }

@media (max-width: 860px) {
  .pr-slide { padding: 80px 24px 48px; }
  .pr-cover-grid, .pr-split, .pr-body-cols { grid-template-columns: 1fr; gap: 28px; }
  .pr-cover-art { display: none; }
  .pr-four, .pr-pillars { grid-template-columns: 1fr 1fr; }
  .pr-stat-strip { grid-template-columns: 1fr; }
  .pr-meta { grid-template-columns: 1fr; }
  .pr-tech-row { grid-template-columns: 36px 1fr 56px; }
  .pr-tech-desc, .pr-glyph { display: none; }
  .pr-rail { display: none; }
}

@media print {
  .pr-bar, .pr-rail { display: none; }
  .pr-deck { position: static; overflow: visible; }
  .pr-slide { min-height: auto; page-break-after: always; padding: 40px; }
}
`;
