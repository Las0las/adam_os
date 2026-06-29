"use client";

import { Icon } from "./icons";
import { FOOTER_CONTEXT, SCOPES, type Scope } from "@/lib/runtime-console/data";

export function StatusFooter({
  scope,
  onCycleScope,
}: {
  scope: Scope;
  onCycleScope: () => void;
}) {
  return (
    <footer className="eor-footer">
      <div className="eor-foot-group">
        <span className="eor-foot-label">Workspace</span>
        <span className="eor-foot-val">
          <Icon name="company" size={14} className="t-accent" /> Aberdeen Recruiting
        </span>
      </div>
      <span className="eor-foot-divider" />

      <div className="eor-foot-group">
        <span className="eor-foot-label">Context (Live)</span>
        <span className="eor-foot-ctx">
          {FOOTER_CONTEXT.map((c) => (
            <span className="item" key={c.label}>
              <Icon name={c.icon} size={13} /> {c.label} <b>{c.value}</b>
            </span>
          ))}
          <span className="item">+3 more</span>
        </span>
      </div>

      <span className="eor-foot-spacer" />

      <div className="eor-foot-group">
        <span className="eor-foot-label">Scope</span>
        <button className="eor-scope-btn" type="button" onClick={onCycleScope} title="Cycle scope">
          {scope} <Icon name="chevron" size={13} />
        </button>
      </div>
      <span className="eor-foot-divider" />

      <div className="eor-foot-group">
        <span className="eor-foot-label">Governance</span>
        <span className="eor-foot-check">
          <Icon name="check" size={13} /> Secure
        </span>
        <span className="eor-foot-check">
          <Icon name="check" size={13} /> Audited
        </span>
        <span className="eor-foot-check">
          <Icon name="check" size={13} /> Policy Ready
        </span>
      </div>
      <span className="eor-foot-divider" />

      <div className="eor-foot-group">
        <span className="dot good" />
        <span className="eor-foot-val">All Systems Operational</span>
        <span className="eor-foot-label" style={{ letterSpacing: 0, textTransform: "none" }}>
          {SCOPES.length ? "Last sync 18s ago" : ""}
        </span>
      </div>
    </footer>
  );
}
