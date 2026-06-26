// Phase 10 — redaction. Strategy primitives + helpers to redact values, objects,
// and free text (detector-driven) for prompts/traces/exports. Never logs or
// returns the raw sensitive value.

import { createHash } from "node:crypto";
import type { DataClassification, RedactionStrategy } from "./data-classification-types";

export function redactValue(value: unknown, strategy: RedactionStrategy, classification?: DataClassification): unknown {
  const s = value == null ? "" : String(value);
  switch (strategy) {
    case "mask":
      return "********";
    case "remove":
      return null;
    case "hash":
      return createHash("sha256").update(s).digest("hex");
    case "token":
      return `[REDACTED:${classification ?? "sensitive"}]`;
    case "last4":
      return s.length >= 4 ? `***${s.slice(-4)}` : "****";
    default:
      return "********";
  }
}

const GLOBAL_REDACTIONS: Array<{ pattern: RegExp; token: string }> = [
  { pattern: /\bsk-ant-[A-Za-z0-9-]{20,}\b/g, token: "[REDACTED:credential]" },
  { pattern: /\bsk-[A-Za-z0-9]{20,}\b/g, token: "[REDACTED:credential]" },
  { pattern: /\bAKIA[0-9A-Z]{16}\b/g, token: "[REDACTED:credential]" },
  { pattern: /\bBearer\s+[A-Za-z0-9._-]{16,}\b/g, token: "[REDACTED:credential]" },
  { pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g, token: "[REDACTED:credential]" },
  { pattern: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/]+/g, token: "[REDACTED:credential]" },
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, token: "[REDACTED:pii]" },
  { pattern: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, token: "[REDACTED:pii]" },
];

/** Redact detected sensitive substrings in free text (token strategy). */
export function redactText(text: string): { text: string; redactionCount: number } {
  let redacted = text;
  let count = 0;
  for (const { pattern, token } of GLOBAL_REDACTIONS) {
    redacted = redacted.replace(pattern, () => {
      count += 1;
      return token;
    });
  }
  return { text: redacted, redactionCount: count };
}

export interface FieldRule {
  fieldPath: string;
  strategy: RedactionStrategy;
  classification?: DataClassification;
}

/** Redact specific object fields per field rules. */
export function redactObject(
  obj: Record<string, unknown>,
  rules: FieldRule[],
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...obj };
  for (const rule of rules) {
    if (rule.fieldPath === "*") {
      for (const k of Object.keys(out)) out[k] = redactValue(out[k], rule.strategy, rule.classification);
    } else if (rule.fieldPath in out) {
      out[rule.fieldPath] = redactValue(out[rule.fieldPath], rule.strategy, rule.classification);
    }
  }
  return out;
}

/** Redact free text for prompt/trace context. */
export function redactForPrompt(text: string): { text: string; redactionCount: number } {
  return redactText(text);
}
