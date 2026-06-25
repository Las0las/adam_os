// Phase 5 — Object Detail presentation helpers. Pure formatting used across the
// detail panels. No assumptions about which property keys exist.

/** Stringify an arbitrary property value for display (nested → compact JSON). */
export function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value.length ? value : "—";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Pretty multi-line JSON for trace/audit payload previews. */
export function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** Truncate a string to a max length, appending an ellipsis when cut. */
export function truncate(text: string, max = 280): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

/** Map a raw status string to a badge tone class (good/warn/bad/neutral). */
export function statusTone(status?: string | null): "good" | "warn" | "bad" | "neutral" {
  const s = (status ?? "").toLowerCase();
  if (["completed", "approved", "resolved", "active", "passed", "ok", "succeeded"].includes(s)) return "good";
  if (["failed", "blocked", "rejected", "error", "critical"].includes(s)) return "bad";
  if (["awaiting_review", "awaiting_approval", "pending", "in_progress", "open", "review"].includes(s)) return "warn";
  return "neutral";
}

const DOMAIN_BY_OBJECT_TYPE: Record<string, string> = {
  Job: "Recruiting",
  Candidate: "Recruiting",
  Application: "Recruiting",
  Submission: "Recruiting",
  OnboardingCase: "Onboarding",
  SupportTicket: "Support",
  ValidationCase: "Claims",
  Claim: "Claims",
  Account: "Executive",
  RiskSignal: "Executive",
};

/** Infer a human domain label from an object type. */
export function domainForObjectType(objectType: string): string {
  return DOMAIN_BY_OBJECT_TYPE[objectType] ?? "Object";
}

/** Read a property as a string if present, else null. Safe for unknown maps. */
export function propString(props: Record<string, unknown>, key: string): string | null {
  const v = props[key];
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return null;
}
