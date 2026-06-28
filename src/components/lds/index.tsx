"use client";

/* ============================================================================
   LDS-001 — LAWRENCE / Aberdeen Design System · Component Library
   ----------------------------------------------------------------------------
   Reusable primitives every LAWRENCE Studio inherits. Presentational and
   hook-free so they compose in both server and client surfaces. The interactive
   Command Center lives in ./command-center (a client component).

   Import the stylesheet here so any consumer of a primitive gets the tokens.
   ========================================================================== */
import "./lds.css";
import type { CSSProperties, ReactNode } from "react";

export type Tone = "good" | "warn" | "bad" | "info" | "neutral" | "brand";
export type ChipState = "resolved" | "suggested" | "pending" | "conflict" | "neutral";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

/* ---- Root ----------------------------------------------------------------- */
export function LdsRoot({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <div className={cx("lds", className)} style={style}>{children}</div>;
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("lds-label", className)}>{children}</div>;
}

/* ============================================================================
   Enterprise Shell
   ========================================================================== */
export interface NavItem { id: string; label: string; icon?: ReactNode; count?: string | number; active?: boolean; onSelect?: () => void; }
export interface NavGroup { title?: string; items: NavItem[]; }

export function EnterpriseShell({
  brand,
  groups,
  footer,
  children,
}: {
  brand: { mark?: ReactNode; name: string; sub?: string };
  groups: NavGroup[];
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="lds lds-shell">
      <nav className="lds-rail" aria-label="Primary">
        <div className="lds-rail-brand">
          <div className="lds-mark">{brand.mark ?? brand.name.charAt(0)}</div>
          <div>
            <div className="nm">{brand.name}</div>
            {brand.sub ? <div className="sub">{brand.sub}</div> : null}
          </div>
        </div>
        {groups.map((g, i) => (
          <div className="lds-rail-group" key={i}>
            {g.title ? <SectionLabel>{g.title}</SectionLabel> : null}
            {g.items.map((it) => (
              <button
                key={it.id}
                type="button"
                className={cx("lds-rail-item", it.active && "active")}
                aria-current={it.active ? "page" : undefined}
                onClick={it.onSelect}
              >
                {it.icon ? <span className="ic">{it.icon}</span> : null}
                <span>{it.label}</span>
                {it.count != null ? <span className="ct">{it.count}</span> : null}
              </button>
            ))}
          </div>
        ))}
        <div className="lds-rail-spacer" />
        {footer ? <div className="lds-rail-foot">{footer}</div> : null}
      </nav>
      <div className="lds-main">{children}</div>
    </div>
  );
}

/* ---- Topbar --------------------------------------------------------------- */
export function Topbar({ crumbs, children }: { crumbs: ReactNode[]; children?: ReactNode }) {
  return (
    <header className="lds-topbar">
      <div className="lds-crumb">
        {crumbs.map((c, i) => (
          <span key={i} className="lds-row" style={{ gap: 8 }}>
            {i > 0 ? <span className="sep">/</span> : null}
            {typeof c === "string" && i === crumbs.length - 1 ? <b>{c}</b> : c}
          </span>
        ))}
      </div>
      <div className="spacer" />
      {children}
    </header>
  );
}

export function CommandTrigger({ onClick, label = "Search or run a command" }: { onClick?: () => void; label?: string }) {
  return (
    <button type="button" className="lds-cmd-trigger" onClick={onClick}>
      <span>{label}</span>
      <span className="lds-kbd">⌘K</span>
    </button>
  );
}

/* ---- Universal Workspace -------------------------------------------------- */
export function Workspace({ children }: { children: ReactNode }) {
  return <div className="lds-workspace">{children}</div>;
}
export function WorkspaceHead({ title, desc, children }: { title: string; desc?: string; children?: ReactNode }) {
  return (
    <div className="lds-ws-head">
      <div>
        <h1>{title}</h1>
        {desc ? <p className="desc">{desc}</p> : null}
      </div>
      <div className="spacer" />
      {children}
    </div>
  );
}
export function WorkspaceGrid({ children, solo }: { children: ReactNode; solo?: boolean }) {
  return <div className={cx("lds-ws-grid", solo && "solo")}>{children}</div>;
}
export function Col({ children }: { children: ReactNode }) {
  return <div className="lds-col">{children}</div>;
}

/* ---- Card / Property Card ------------------------------------------------- */
export function Card({ title, label, actions, children, tight }: { title?: ReactNode; label?: ReactNode; actions?: ReactNode; children: ReactNode; tight?: boolean }) {
  return (
    <section className="lds-card">
      {title || actions || label ? (
        <div className="lds-card-head">
          {label ? <SectionLabel>{label}</SectionLabel> : null}
          {title ? <h3>{title}</h3> : null}
          <span className="spacer" />
          {actions}
        </div>
      ) : null}
      <div className={cx("lds-card-body", tight && "tight")}>{children}</div>
    </section>
  );
}
export function PropertyRow({ k, children }: { k: ReactNode; children: ReactNode }) {
  return (
    <div className="lds-prop-row">
      <div className="k">{k}</div>
      <div className="v">{children}</div>
    </div>
  );
}
export function EmptyValue({ children = "Not provided" }: { children?: ReactNode }) {
  return <span className="empty">{children}</span>;
}

/* ---- KPI ------------------------------------------------------------------ */
export function Kpi({ value, label, sub, accent }: { value: ReactNode; label: ReactNode; sub?: ReactNode; accent?: boolean }) {
  return (
    <div className="lds-kpi">
      <div className={cx("val", accent && "accent")}>{value}</div>
      <SectionLabel className="lab">{label}</SectionLabel>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  );
}
export function KpiRow({ children }: { children: ReactNode }) {
  return <div className="lds-kpis">{children}</div>;
}

/* ---- Smart Enterprise Chip ------------------------------------------------ */
export function Chip({ state = "neutral", children, onRemove }: { state?: ChipState; children: ReactNode; onRemove?: () => void }) {
  return (
    <span className={cx("lds-chip", state)}>
      <span className="dot" />
      {children}
      {onRemove ? <button type="button" aria-label="Remove" onClick={onRemove}>×</button> : null}
    </span>
  );
}
export function ChipRow({ children }: { children: ReactNode }) {
  return <div className="lds-chip-row">{children}</div>;
}

/* ---- Badge / dot ---------------------------------------------------------- */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx("lds-badge", tone)}>{children}</span>;
}
export function StatusDot({ tone = "neutral" }: { tone?: Tone }) {
  return <span className={cx("lds-dot", tone)} />;
}

/* ---- Button --------------------------------------------------------------- */
export function Button({
  variant = "ghost",
  size,
  children,
  ...rest
}: { variant?: "primary" | "accent" | "ghost" | "quiet"; size?: "sm" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={cx("lds-btn", `lds-btn--${variant}`, size === "sm" && "lds-btn--sm")} {...rest}>
      {children}
    </button>
  );
}

/* ---- Progressive Structured Input ----------------------------------------- */
export interface StepDef { id: string; label: string; }
export function Steps({ steps, currentIndex, doneIds }: { steps: StepDef[]; currentIndex: number; doneIds?: string[] }) {
  return (
    <div className="lds-steps">
      {steps.map((s, i) => {
        const done = doneIds?.includes(s.id);
        const active = i === currentIndex;
        return (
          <div key={s.id} className={cx("lds-step", active && "active", done && "done")}>
            <span className="node">{done ? "✓" : i + 1}</span>
            <span className="nm">{s.label}</span>
            {i < steps.length - 1 ? <span className="bar" /> : null}
          </div>
        );
      })}
    </div>
  );
}

export function Field({ label, required, hint, done, children }: { label: ReactNode; required?: boolean; hint?: ReactNode; done?: boolean; children: ReactNode }) {
  return (
    <div className={cx("lds-field", done && "done")}>
      <div className="lds-field-head">
        <label>{label}</label>
        {required ? <span className="req">*</span> : null}
        <span className="spacer" />
        {done ? <Badge tone="good">CAPTURED</Badge> : null}
      </div>
      {children}
      {hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="lds-input" {...props} />;
}
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="lds-textarea" {...props} />;
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="lds-select" {...props} />;
}

/* ---- Advisor Rail --------------------------------------------------------- */
export function AdvisorRail({ children }: { children: ReactNode }) {
  return <div className="lds-advisor">{children}</div>;
}
export function AdvisorItem({ tone = "advise", title, confidence, children, actions }: { tone?: "advise" | "suggest" | "warn"; title: ReactNode; confidence?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className={cx("lds-advisor-item", tone)}>
      <div className="at">
        {title}
        {confidence != null ? <span className="lds-advisor-conf">{confidence}</span> : null}
      </div>
      <div className="ab">{children}</div>
      {actions ? <div className="aa">{actions}</div> : null}
    </div>
  );
}

/* ---- Inspector Panel ------------------------------------------------------ */
export function Inspector({ title, tabs, active, onTab, children }: { title: ReactNode; tabs?: { id: string; label: string }[]; active?: string; onTab?: (id: string) => void; children: ReactNode }) {
  return (
    <aside className="lds-inspector">
      <div className="lds-inspector-head"><span className="ttl">{title}</span></div>
      {tabs && tabs.length ? (
        <div className="lds-inspector-tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={active === t.id} className={cx("lds-inspector-tab", active === t.id && "active")} onClick={() => onTab?.(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="lds-inspector-body">{children}</div>
    </aside>
  );
}

/* ---- Activity Timeline ---------------------------------------------------- */
export function Timeline({ children }: { children: ReactNode }) {
  return <div className="lds-timeline">{children}</div>;
}
export function TimelineItem({ tone = "neutral", title, meta, ts }: { tone?: Tone | "accent"; title: ReactNode; meta?: ReactNode; ts?: ReactNode }) {
  return (
    <div className="lds-tl-item">
      <span className={cx("lds-tl-node", tone)} />
      <div className="lds-tl-body">
        <div className="t">{title}</div>
        {meta ? <div className="m">{meta}</div> : null}
        {ts ? <div className="ts">{ts}</div> : null}
      </div>
    </div>
  );
}

/* ---- Evidence Panel ------------------------------------------------------- */
export function EvidencePanel({ children }: { children: ReactNode }) {
  return <div className="lds-evidence">{children}</div>;
}
export function EvidenceItem({ title, source, provenance, children }: { title: ReactNode; source?: ReactNode; provenance?: ReactNode; children: ReactNode }) {
  return (
    <div className="lds-ev-item">
      <div className="eh">{title}{source ? <span className="src">{source}</span> : null}</div>
      <div className="eb">{children}</div>
      {provenance ? <div className="prov">{provenance}</div> : null}
    </div>
  );
}

/* ---- Diagnostics ---------------------------------------------------------- */
export function Diagnostics({ children }: { children: ReactNode }) {
  return <div className="lds-diag">{children}</div>;
}
export function DiagnosticRow({ tone = "neutral", label, detail, badge }: { tone?: Tone; label: ReactNode; detail?: ReactNode; badge?: ReactNode }) {
  return (
    <div className="lds-diag-row">
      <StatusDot tone={tone} />
      <div className="dt">
        <div className="dl">{label}</div>
        {detail ? <div className="dd">{detail}</div> : null}
      </div>
      {badge}
    </div>
  );
}
