"use client";

/* ============================================================================
   PSI-001 — Progressive Structured Input · Field Primitive
   ----------------------------------------------------------------------------
   The canonical input control for EVERY Enterprise Property in LAWRENCE.
   It owns NO property logic — it is a pure projection of one runtime field
   plus a set of acquisition methods that all funnel through ONE `commit`
   callback, which writes the governed Enterprise Property via the EPR runtime.

   VISUAL HIERARCHY (cognitive-load pass):
   A field has TWO states so the object has a clear center of gravity —
     • RESOLVED (calm) — the VALUE is the hero; acquisition machinery is hidden
       behind a single quiet "Edit" affordance. Resolved fields recede.
     • ACTIVE (editor) — shown only for unresolved fields or when the user opts
       in to edit. This is the only place the full acquisition rail appears, so
       attention is drawn precisely to the work that remains.

   Normative coverage (PSI-001):
     PSI-1  Direct Manipulation .......... inline editor, no modal edit mode
     PSI-2  Suggestions accelerate ....... free text ALWAYS wins; chips never gate input
     PSI-3  Multiple acquisition methods . Click · Type · Paste · AI Generate · AI Rewrite
     PSI-4  Enterprise Properties ........ every method emits the same Property (key+src+conf)
     PSI-5  Inline Intelligence .......... AI lives at the field, never a separate surface
     PSI-7  Editable Summary Chips ....... selected values are chips that edit the property
     PSI-11 AI is a collaborator ......... AI proposes; the user's typed value is final
   ========================================================================== */

import { useRef, useState } from "react";
import type { Provenance } from "@/lib/epr";

/** The projected shape of a single field, as returned by buildSections(). */
export interface PsiProjectedField {
  key: string;
  label: string;
  kind: "single" | "multi" | "text";
  req?: boolean;
  hasValue: boolean;
  value: string | string[];
  srcLabel: string;
  srcColor: string;
  srcBg: string;
  srcBorder?: string;
  confText: string;
  evidence: string[];
  evN: number;
  chips: { label: string; selected: boolean }[];
  selected: string[];
}

export interface PsiFieldProps {
  field: PsiProjectedField;
  /** The single mutation chokepoint — every acquisition method flows here. */
  commit: (value: string | string[], src: Provenance, conf: number, evidence: string | null) => void;
  /** Deterministic, evidence-backed AI proposal for this field. */
  aiPropose: () => void;
}

/** Confidence the runtime assigns per acquisition method (honest, source-aware). */
const CONF: Record<string, number> = {
  typed: 1.0, // PSI-11: a human-typed value is authoritative
  paste: 0.85,
  suggestion: 0.8,
  ai: 0.92,
};

export function PsiField({ field: f, commit, aiPropose }: PsiFieldProps) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isMulti = f.kind === "multi";
  // Unresolved fields always show the editor; resolved fields stay calm until "Edit".
  const showEditor = editing || !f.hasValue;

  // PSI-2: whatever the user typed becomes the property verbatim — free text wins.
  function commitTyped() {
    const v = draft.trim();
    if (!v) return;
    if (isMulti) {
      const cur = f.selected;
      if (cur.indexOf(v) < 0) commit([...cur, v], "typed", CONF.typed, null);
    } else {
      commit(v, "typed", CONF.typed, null);
    }
    setDraft("");
    inputRef.current?.focus();
  }

  function clickChip(label: string) {
    if (isMulti) {
      const cur = f.selected;
      const next = cur.indexOf(label) >= 0 ? cur.filter((x) => x !== label) : [...cur, label];
      commit(next, "suggestion", CONF.suggestion, null);
    } else {
      commit(label, "suggestion", CONF.suggestion, null);
    }
  }

  function removeChip(label: string) {
    commit(f.selected.filter((x) => x !== label), "typed", CONF.typed, null);
  }

  // PSI-3: Paste — extract structured value(s) from pasted text.
  function commitPaste() {
    const raw = pasteText.trim();
    if (!raw) return;
    if (isMulti) {
      const parts = raw.split(/[\n,;•]+/).map((s) => s.trim()).filter(Boolean).slice(0, 12);
      const merged = Array.from(new Set([...f.selected, ...parts]));
      commit(merged, "paste", CONF.paste, `Pasted ${parts.length} value(s)`);
    } else {
      const first = raw.split(/[\n]+/)[0].trim();
      commit(first, "paste", CONF.paste, "Pasted from clipboard");
    }
    setPasteText("");
    setPasteOpen(false);
  }

  const placeholder = isMulti ? `Add ${f.label.toLowerCase()}…` : `Type ${f.label.toLowerCase()}…`;
  const singleValue = !isMulti && typeof f.value === "string" ? f.value : "";

  /* -------------------------------------------------------------------------
     RESOLVED (calm) state — value is the hero; machinery is hidden.
     ---------------------------------------------------------------------- */
  if (!showEditor) {
    return (
      <div
        className="psi-resolved"
        style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "9px 0", borderTop: "1px solid #eef3f7" }}
      >
        <div style={{ flex: "0 0 132px", paddingTop: 2 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#6b7a8a" }}>
            {f.label}
            {f.req && <span style={{ color: "#db504a" }}> *</span>}
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* THE HERO — the resolved value, read clearly */}
          {isMulti ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {f.selected.map((v) => (
                <span key={v} style={{ fontSize: 13, fontWeight: 600, padding: "3px 9px", borderRadius: 7, background: "#eef5f5", color: "#0a5c5d", border: "1px solid #d4e8e8" }}>
                  {v}
                </span>
              ))}
            </div>
          ) : (
            <span style={{ fontSize: 15, fontWeight: 600, color: "#15212c", lineHeight: 1.35, wordBreak: "break-word" }}>
              {singleValue}
            </span>
          )}
          {/* Provenance recedes to a quiet caption */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 10.5, color: "#9aa7b4" }}>
              {f.srcLabel} · {f.confText}
            </span>
            {f.evN > 0 && (
              <span title={f.evidence.join(" · ")} style={{ fontSize: 10.5, color: "#7d8a98" }}>
                ◆ {f.evN}
              </span>
            )}
          </div>
        </div>
        <button
          className="psi-edit"
          onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 0); }}
          style={{
            flex: "0 0 auto", fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: 7,
            border: "1px solid transparent", background: "transparent", color: "#44b0b1", cursor: "pointer",
          }}
        >
          Edit
        </button>
      </div>
    );
  }

  /* -------------------------------------------------------------------------
     ACTIVE (editor) state — the full acquisition rail, only where work remains.
     ---------------------------------------------------------------------- */
  return (
    <div style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e2eaf1", background: "#fbfdff" }}>
      {/* Label + provenance + a quiet Done to recede the field once resolved */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#15212c" }}>
          {f.label}
          {f.req && <span style={{ color: "#db504a" }}> *</span>}
        </span>
        {f.hasValue && (
          <span
            style={{
              fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
              color: f.srcColor, background: f.srcBg, border: `1px solid ${f.srcBorder || f.srcColor}`,
            }}
          >
            {f.srcLabel} · {f.confText}
          </span>
        )}
        {f.evN > 0 && (
          <span title={f.evidence.join(" · ")} style={{ fontSize: 10, color: "#00875f", fontWeight: 600 }}>
            ◆ {f.evN} evidence
          </span>
        )}
        {f.hasValue && (
          <button
            onClick={() => { setEditing(false); setPasteOpen(false); setDraft(""); }}
            style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 7, border: "1px solid #cdd9e3", background: "#fff", color: "#516170", cursor: "pointer" }}
          >
            Done
          </button>
        )}
      </div>

      {/* PSI-7: committed values render as EDITABLE summary chips */}
      {isMulti && f.selected.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {f.selected.map((v) => (
            <button
              key={v}
              onClick={() => removeChip(v)}
              title="Remove"
              style={{
                fontSize: 12, padding: "4px 10px", borderRadius: 999, fontWeight: 600,
                border: "1px solid #44b0b1", background: "#e6f6f6", color: "#0a5c5d", cursor: "pointer",
              }}
            >
              {v} ×
            </button>
          ))}
        </div>
      )}

      {/* PSI-1 + PSI-2: always-present inline editor. Free text is first-class. */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitTyped();
            }
          }}
          placeholder={singleValue ? `${singleValue}  —  type to replace` : placeholder}
          aria-label={f.label}
          style={{
            flex: 1, fontSize: 13, padding: "8px 11px", borderRadius: 8,
            border: "1px solid #cdd9e3", background: "#fff", color: "#1f2d3a",
            fontFamily: "inherit",
          }}
        />
        <button
          onClick={commitTyped}
          disabled={!draft.trim()}
          style={{
            fontSize: 12, padding: "8px 13px", borderRadius: 8, fontWeight: 600,
            border: "1px solid #09375f", background: draft.trim() ? "#09375f" : "#cdd9e3",
            color: "#fff", cursor: draft.trim() ? "pointer" : "not-allowed",
          }}
        >
          Set
        </button>
      </div>

      {/* PSI-3: acquisition rail — Click (chips) · Paste · AI Generate / Rewrite */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {f.chips
          .filter((c) => !c.selected)
          .slice(0, 5)
          .map((c) => (
            <button
              key={c.label}
              onClick={() => clickChip(c.label)}
              style={{
                fontSize: 12, padding: "4px 10px", borderRadius: 999,
                border: "1px solid #d8e2ec", background: "#fff", color: "#516170", cursor: "pointer",
              }}
            >
              {c.label}
            </button>
          ))}
        <span style={{ flex: 1 }} />
        <button
          onClick={() => setPasteOpen((v) => !v)}
          style={{
            fontSize: 11, padding: "4px 9px", borderRadius: 7, fontWeight: 600,
            border: "1px solid #d8e2ec", background: "#fff", color: "#7d8a98", cursor: "pointer",
          }}
        >
          Paste
        </button>
        <button
          onClick={aiPropose}
          style={{
            fontSize: 11, padding: "4px 9px", borderRadius: 7, fontWeight: 600,
            border: "1px solid #bde6e6", background: "#e6f6f6", color: "#0a5c5d", cursor: "pointer",
          }}
        >
          {f.hasValue ? "✦ AI Rewrite" : "✦ AI Generate"}
        </button>
      </div>

      {/* PSI-3: paste capture (extracts → same governed property) */}
      {pasteOpen && (
        <div style={{ marginTop: 8 }}>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={isMulti ? "Paste a list (comma / newline separated)…" : "Paste text — first line is used…"}
            rows={3}
            style={{
              width: "100%", fontSize: 12, padding: "8px 10px", borderRadius: 8,
              border: "1px solid #cdd9e3", background: "#fff", color: "#1f2d3a",
              fontFamily: "inherit", resize: "vertical",
            }}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <button
              onClick={commitPaste}
              disabled={!pasteText.trim()}
              style={{
                fontSize: 11, padding: "5px 12px", borderRadius: 7, fontWeight: 600,
                border: "1px solid #09375f", background: pasteText.trim() ? "#09375f" : "#cdd9e3",
                color: "#fff", cursor: pasteText.trim() ? "pointer" : "not-allowed",
              }}
            >
              Extract
            </button>
            <button
              onClick={() => { setPasteOpen(false); setPasteText(""); }}
              style={{
                fontSize: 11, padding: "5px 12px", borderRadius: 7,
                border: "1px solid #cdd9e3", background: "#fff", color: "#516170", cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
