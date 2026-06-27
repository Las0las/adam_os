// Security Middleware Platform (Milestone 6.0, deliverable #2) — PII Redaction.
//
// Deterministic, rule-based detection and masking of common PII in the request
// prompt. Policies: off · detect (emit event, no change) · mask (replace matches
// with a token, emit events, hand the provider the redacted request) · reject
// (block when PII is present). No persistence, no external services.
//
// Attaches as execution middleware via `interceptRequest`. In mask mode it
// returns a NEW request with a redacted prompt — it never mutates the caller's
// request object, and the default policy is detect-only so no prompt is altered
// unless explicitly configured.

import type { CompletionRequest } from "@/lib/aiops/models/model-provider";
import type { InferenceExecutionContext } from "@/lib/aiops/execution/execution-types";
import { SecurityViolationError } from "@/lib/aiops/execution/execution-errors";
import { guard, type ExecutionMiddleware } from "@/lib/aiops/execution/observability/execution-middleware";
import type { ExecutionEventBus } from "@/lib/aiops/execution/observability/execution-event-bus";
import { piiDetected, piiMasked } from "./security-events";
import { SECURITY_PRIORITY, type PiiKind, type SecurityPolicyStore } from "./security-types";

interface PatternDef {
  kind: string;
  regex: RegExp;
  /** Optional extra validation (e.g. Luhn) to suppress false positives. */
  valid?: (match: string) => boolean;
}

/** Luhn checksum — used to confirm credit-card-shaped digit runs. */
function luhnValid(value: string): boolean {
  const digits = value.replace(/[^\d]/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function octetsValid(value: string): boolean {
  return value.split(".").every((o) => {
    const n = Number(o);
    return n >= 0 && n <= 255;
  });
}

/** Built-in PII patterns. Regexes use the global flag so all matches are found
 *  and replaced; they are kept simple to stay deterministic (no backtracking). */
const BUILTIN_PATTERNS: Record<PiiKind, PatternDef> = {
  email: { kind: "email", regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  phone: { kind: "phone", regex: /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g },
  ssn: { kind: "ssn", regex: /\b\d{3}-\d{2}-\d{4}\b/g },
  credit_card: { kind: "credit_card", regex: /\b(?:\d[ -]?){13,19}\b/g, valid: luhnValid },
  api_key: { kind: "api_key", regex: /\b(?:sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/g },
  access_token: { kind: "access_token", regex: /\b(?:Bearer\s+[A-Za-z0-9._~+/-]{12,}=*|eyJ[A-Za-z0-9._-]{12,})\b/g },
  ip_address: { kind: "ip_address", regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, valid: octetsValid },
};

function activePatterns(kinds: PiiKind[], custom: { name: string; pattern: string }[]): PatternDef[] {
  const selected = kinds.length > 0 ? kinds : (Object.keys(BUILTIN_PATTERNS) as PiiKind[]);
  const builtins = selected.map((k) => BUILTIN_PATTERNS[k]).filter(Boolean);
  const customDefs: PatternDef[] = custom.map((c) => ({
    kind: c.name,
    // Custom patterns are made global so every occurrence is masked.
    regex: new RegExp(c.pattern, "g"),
  }));
  return [...builtins, ...customDefs];
}

export interface PiiFinding {
  kind: string;
  value: string;
}

/** Find all PII matches in `text` for the active patterns. Deterministic order:
 *  by pattern, then by position. */
export function detectPii(text: string, patterns: PatternDef[]): PiiFinding[] {
  const findings: PiiFinding[] = [];
  for (const def of patterns) {
    const re = new RegExp(def.regex.source, def.regex.flags.includes("g") ? def.regex.flags : def.regex.flags + "g");
    for (const m of text.matchAll(re)) {
      const value = m[0];
      if (def.valid && !def.valid(value)) continue;
      findings.push({ kind: def.kind, value });
    }
  }
  return findings;
}

/** Replace every finding with the mask token. */
function maskText(text: string, findings: PiiFinding[], token: string): string {
  let out = text;
  // Replace longest matches first so a value contained in another isn't
  // partially masked.
  const values = [...new Set(findings.map((f) => f.value))].sort((a, b) => b.length - a.length);
  for (const value of values) {
    out = out.split(value).join(token);
  }
  return out;
}

export class PIIRedaction implements ExecutionMiddleware {
  readonly name = "pii-redaction";
  readonly priority = SECURITY_PRIORITY.pii;

  constructor(
    private readonly bus: ExecutionEventBus,
    private readonly store: SecurityPolicyStore,
  ) {}

  interceptRequest(request: CompletionRequest, ctx: InferenceExecutionContext): CompletionRequest {
    const policy = this.store.current();
    if (!policy.enabled.pii || policy.pii.policy === "off") return request;

    const prompt = request.prompt ?? "";
    const patterns = activePatterns(policy.pii.kinds, policy.pii.customPatterns);
    const findings = detectPii(prompt, patterns);
    if (findings.length === 0) return request;

    const kinds = [...new Set(findings.map((f) => f.kind))];
    guard(() => this.bus.publish(piiDetected(ctx, kinds, findings.length)));

    if (policy.pii.policy === "reject") {
      throw new SecurityViolationError(`request rejected: PII present (${kinds.join(", ")})`);
    }

    if (policy.pii.policy === "mask") {
      const masked = maskText(prompt, findings, policy.pii.maskToken);
      guard(() => this.bus.publish(piiMasked(ctx, kinds, findings.length)));
      return { ...request, prompt: masked };
    }

    // detect mode: emit only; pass the request through unchanged.
    return request;
  }
}
