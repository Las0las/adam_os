"use client";

// ─────────────────────────────────────────────────────────────────────────
// LIS · Pattern 2 — In-Line Projections & Ghost Text
// Layers temporary / streaming / uncommitted modifications directly over a
// static field, with ZERO layout thrash. Inherits the LIS-001 state tokens.
//   idle       → shows baseValue, no decoration
//   streaming  → ghost text (dim + italic), value arriving from backend
//   optimistic → speculative diff: deletion strike-through + insertion overlay
//   rejected   → reverts; brief rejection flash
// State is exposed as data-state so the stylesheet (not JS) owns the look.
// ─────────────────────────────────────────────────────────────────────────

export type InlineStatus = "idle" | "streaming" | "optimistic" | "rejected";

export interface InlineProjectorProps {
  baseValue: string;
  projectedValue?: string;
  status: InlineStatus;
  type?: "text" | "token-chip";
}

/** data-state values map 1:1 to the speculative-diff CSS contract. */
function diffState(status: InlineStatus): string {
  switch (status) {
    case "streaming":
      return "runtime-executing";
    case "optimistic":
      return "speculative";
    case "rejected":
      return "rejected";
    default:
      return "idle";
  }
}

export function InlineProjector({
  baseValue,
  projectedValue,
  status,
  type = "text",
}: InlineProjectorProps) {
  const hasProjection = status !== "idle" && projectedValue != null && projectedValue !== baseValue;

  // ── Streaming: ghost text replaces the base inline, no reflow ──────────────
  if (status === "streaming") {
    return (
      <span className={`lis-inline ${type === "token-chip" ? "is-chip" : ""}`} data-state="runtime-executing">
        <span className="lis-inline-stack">
          {/* invisible base reserves the widest box → no jump when ghost lands */}
          <span className="lis-inline-ghosted" aria-hidden>
            {projectedValue && projectedValue.length > baseValue.length ? projectedValue : baseValue}
          </span>
          <span className="lis-inline-ghost">
            {projectedValue ?? baseValue}
            <span className="lis-inline-caret" aria-hidden />
          </span>
        </span>
      </span>
    );
  }

  // ── Optimistic: speculative deletion + insertion, both inline ──────────────
  if (status === "optimistic" && hasProjection) {
    return (
      <span className={`lis-inline ${type === "token-chip" ? "is-chip" : ""}`} data-state="speculative">
        <span className="lis-inline-del" data-state="speculative-deletion">
          {baseValue}
        </span>
        <span className="lis-inline-ins" data-state="speculative-insertion">
          {projectedValue}
        </span>
      </span>
    );
  }

  // ── Rejected: revert to base with a brief flash ────────────────────────────
  if (status === "rejected") {
    return (
      <span className={`lis-inline ${type === "token-chip" ? "is-chip" : ""}`} data-state="rejected">
        {baseValue}
      </span>
    );
  }

  // ── Idle ───────────────────────────────────────────────────────────────────
  return (
    <span className={`lis-inline ${type === "token-chip" ? "is-chip" : ""}`} data-state={diffState(status)}>
      {baseValue}
    </span>
  );
}
