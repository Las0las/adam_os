"use client";

/**
 * ObjectActionBar — the STD-UX-0001 Part III primitive.
 * Every Enterprise Object inherits this IDENTICAL action set. The bar owns no
 * object logic; mutating capabilities route through governed callbacks (they
 * never mutate state directly), satisfying the Part III normative contract.
 */

import { useState } from "react";
import { OBJECT_ACTIONS, type ActionKind, type ObjectActionDef } from "@/lib/std-ux/canon";

export interface ObjectActionBarProps {
  /** Object identity, for reference/copy provenance. */
  objectLabel: string;
  objectGlyph?: string;
  /** Stable deep-link reference (Copy / Reference / Insert). */
  referenceId?: string;
  /** Governed: advance the object to its next maturity state. Null disables Evolve. */
  onEvolve?: (() => void) | null;
  /** Human-readable description of the next evolution (for the Evolve tooltip). */
  nextEvolution?: string | null;
  /** Governed: open Advisor reasoning. */
  onAskAdvisor?: () => void;
  /** Optional projection switch target (Compare). */
  onCompare?: () => void;
  /** Emits a transient governed-activity note the host can record. */
  onActivity?: (note: string) => void;
}

// Capabilities shown inline; the rest live in the overflow menu.
const PRIMARY: ActionKind[] = ["edit", "evolve", "compare", "advisor", "history"];

export function ObjectActionBar({
  objectLabel,
  objectGlyph,
  referenceId,
  onEvolve,
  nextEvolution,
  onAskAdvisor,
  onCompare,
  onActivity,
}: ObjectActionBarProps) {
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  function note(msg: string) {
    setFlash(msg);
    onActivity?.(msg);
    window.setTimeout(() => setFlash((cur) => (cur === msg ? null : cur)), 2400);
  }

  function run(a: ObjectActionDef) {
    setOpen(false);
    switch (a.kind) {
      case "evolve":
        if (onEvolve) {
          onEvolve();
          note(`Evolve · ${nextEvolution || "advanced to next maturity state"}`);
        }
        return;
      case "advisor":
        onAskAdvisor?.();
        note("Ask Advisor · reasoning over the object");
        return;
      case "compare":
        onCompare?.();
        note("Compare · opened side-by-side");
        return;
      case "copy":
      case "reference":
      case "insert": {
        const ref = `lawrence://object/${referenceId || objectLabel}`;
        if (typeof navigator !== "undefined" && navigator.clipboard) {
          navigator.clipboard.writeText(ref).then(() => note(`${a.label} · ${ref}`)).catch(() => note(`${a.label} · ${ref}`));
        } else {
          note(`${a.label} · ${ref}`);
        }
        return;
      }
      default:
        // View / Pin / Branch / Duplicate / Share / Archive — governed actions
        // emit an activity note the host records; the host wires real effects.
        note(`${a.label}${a.governed ? " · governed" : ""}`);
    }
  }

  const primary = OBJECT_ACTIONS.filter((a) => PRIMARY.includes(a.kind));
  const overflow = OBJECT_ACTIONS.filter((a) => !PRIMARY.includes(a.kind));
  const evolveDisabled = onEvolve == null;

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      {objectGlyph && (
        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "#6b7a8a", marginRight: 2 }}>
          {objectGlyph}
        </span>
      )}
      {primary.map((a) => {
        const isEvolve = a.kind === "evolve";
        const disabled = isEvolve && evolveDisabled;
        return (
          <button
            key={a.kind}
            onClick={() => !disabled && run(a)}
            disabled={disabled}
            title={isEvolve && nextEvolution ? `Evolve → ${nextEvolution}` : a.contract}
            aria-label={a.label}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 12, fontWeight: isEvolve ? 700 : 600,
              padding: "5px 11px", borderRadius: 7, cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.4 : 1,
              border: isEvolve ? "none" : "1px solid #cdd9e3",
              background: isEvolve ? "#44b0b1" : "#fff",
              color: isEvolve ? "#063a3a" : "#33424f",
            }}
          >
            {isEvolve && <span aria-hidden style={{ fontSize: 13, lineHeight: 1 }}>✦</span>}
            {a.label}
            {a.signature && (
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.4, background: "#063a3a", color: "#9ff0ef", borderRadius: 4, padding: "1px 4px" }}>
                LAWRENCE
              </span>
            )}
          </button>
        );
      })}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="More object actions"
        aria-expanded={open}
        title="More inherited actions"
        style={{
          fontSize: 14, fontWeight: 700, lineHeight: 1, padding: "5px 10px", borderRadius: 7,
          cursor: "pointer", border: "1px solid #cdd9e3", background: "#fff", color: "#33424f",
        }}
      >
        ⋯
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div
            role="menu"
            style={{
              position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 41,
              minWidth: 230, background: "#fff", border: "1px solid #d9e1ea", borderRadius: 10,
              boxShadow: "0 12px 32px rgba(9,55,95,.16)", padding: 6,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: "#9aa7b4", padding: "6px 8px 4px" }}>
              INHERITED OBJECT ACTIONS
            </div>
            {overflow.map((a) => (
              <button
                key={a.kind}
                role="menuitem"
                onClick={() => run(a)}
                title={a.contract}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
                  fontSize: 12.5, padding: "7px 8px", borderRadius: 6, border: "none",
                  background: "transparent", color: "#33424f", cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f4f7fa")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ flex: 1 }}>{a.label}</span>
                {a.governed && (
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#0a5c5d", background: "#e6f6f6", border: "1px solid #bde6e6", borderRadius: 4, padding: "1px 5px" }}>
                    governed
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {flash && (
        <span
          role="status"
          style={{
            marginLeft: 4, fontSize: 11, fontWeight: 600, color: "#0a5c5d",
            background: "#e6f6f6", border: "1px solid #bde6e6", borderRadius: 999, padding: "3px 10px",
          }}
        >
          {flash}
        </span>
      )}
    </div>
  );
}
