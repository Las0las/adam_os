// Security Middleware Platform (Milestone 6.0) — policy contracts.
//
// A SecurityPolicy declares which security middleware are active and how they
// behave. Policies are IMMUTABLE during an execution: the store hands out a
// deep-frozen snapshot, and reconfiguration replaces the snapshot wholesale
// rather than mutating it. Defaults are deliberately NON-DISRUPTIVE so enabling
// the layer changes no existing behavior: the firewall blocks only clearly
// malicious patterns, PII defaults to detect-only (no prompt mutation), and the
// validator enforces only permissive invariants that legitimate responses pass.

import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import type { CompletionResponse } from "@/lib/aiops/models/model-provider";

export type FirewallMode = "off" | "detect" | "enforce";
export type PiiPolicyMode = "off" | "detect" | "mask" | "reject";
export type ValidationMode = "off" | "enforce";

/** Built-in PII categories the redaction engine can detect/mask. */
export type PiiKind =
  | "email"
  | "phone"
  | "ssn"
  | "credit_card"
  | "api_key"
  | "access_token"
  | "ip_address";

/** A caller-supplied invariant the response must satisfy. Held as a function
 *  reference on the (frozen) policy — not serialized. */
export interface SecurityInvariant {
  name: string;
  check(response: CompletionResponse): boolean;
}

export interface FirewallConfig {
  mode: FirewallMode;
  /** Substrings that, when present, exempt a prompt from firewall rejection. */
  allowList: string[];
  /** Substrings that always trigger a firewall match. */
  denyList: string[];
}

export interface PiiConfig {
  policy: PiiPolicyMode;
  /** Which built-in kinds to scan for. Empty = all built-ins. */
  kinds: PiiKind[];
  /** Additional named patterns (regex source strings). */
  customPatterns: { name: string; pattern: string }[];
  /** Replacement token used in Mask mode. */
  maskToken: string;
}

export interface ValidationPolicy {
  mode: ValidationMode;
  /** Require a parseable JSON payload on the response. */
  requireJson: boolean;
  /** Minimal JSON-schema-ish shape ({ properties, required }). */
  schema: Record<string, unknown> | null;
  /** Fields that must be present on the JSON payload. */
  requiredFields: string[];
  /** Maximum serialized response size in bytes. */
  maxPayloadBytes: number;
  /** Reject responses whose text is not valid UTF-8. */
  utf8: boolean;
  /** Caller-supplied business invariants. */
  invariants: SecurityInvariant[];
}

export interface SecurityPolicy {
  enabled: { firewall: boolean; pii: boolean; validator: boolean };
  firewall: FirewallConfig;
  pii: PiiConfig;
  validation: ValidationPolicy;
}

/** The default, non-disruptive policy: the layer is fully active but only blocks
 *  clearly malicious prompts, never mutates a benign prompt, and only validates
 *  invariants every legitimate response already satisfies. */
export function defaultSecurityPolicy(): SecurityPolicy {
  return {
    enabled: { firewall: true, pii: true, validator: true },
    firewall: { mode: "enforce", allowList: [], denyList: [] },
    pii: { policy: "detect", kinds: [], customPatterns: [], maskToken: "[REDACTED]" },
    validation: {
      mode: "enforce",
      requireJson: false,
      schema: null,
      requiredFields: [],
      maxPayloadBytes: 5_000_000,
      utf8: true,
      invariants: [],
    },
  };
}

/**
 * Holds the active security policy as an immutable snapshot. `current()` returns
 * a deep-frozen policy that callers may read freely during an execution;
 * `configure()` swaps in a new frozen snapshot (it never mutates in place), so an
 * in-flight execution always sees a consistent policy.
 */
export class SecurityPolicyStore {
  private policy: SecurityPolicy;

  constructor(policy: SecurityPolicy = defaultSecurityPolicy()) {
    this.policy = deepFreeze(policy);
  }

  current(): SecurityPolicy {
    return this.policy;
  }

  configure(policy: SecurityPolicy): void {
    this.policy = deepFreeze(policy);
  }
}

/** Canonical chain positions for the security middleware. All run before the
 *  event publisher (priority 10) so security events precede the terminal
 *  execution event. */
export const SECURITY_PRIORITY = {
  firewall: 1,
  pii: 2,
  validator: 3,
} as const;
