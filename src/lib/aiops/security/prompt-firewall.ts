// Security Middleware Platform (Milestone 6.0, deliverable #1) — Prompt Firewall.
//
// A deterministic, RULE-BASED firewall that inspects the request prompt before it
// reaches a provider. It detects prompt-injection / instruction-override /
// jailbreak / recursive-expansion / system-prompt-extraction / tool-manipulation
// / credential-exfiltration patterns plus a configurable deny list, and honors a
// configurable allow list. It does NOT use another model to classify (out of
// scope) — patterns are explicit and configurable, so detection is reproducible.
//
// Modes: off (skip) · detect (flag + emit event, allow) · enforce (block + throw).
// It attaches as execution middleware via `interceptRequest`; it inspects and may
// reject, but never reroutes, retries, or mutates provider behavior.

import type { CompletionRequest } from "@/lib/aiops/models/model-provider";
import type { InferenceExecutionContext } from "@/lib/aiops/execution/execution-types";
import { SecurityViolationError } from "@/lib/aiops/execution/execution-errors";
import { guard, type ExecutionMiddleware } from "@/lib/aiops/execution/observability/execution-middleware";
import type { ExecutionEventBus } from "@/lib/aiops/execution/observability/execution-event-bus";
import { promptInspected } from "./security-events";
import { SECURITY_PRIORITY, type SecurityPolicyStore } from "./security-types";

/** A named detection rule. Patterns are intentionally specific so legitimate
 *  prompts do not match (low false-positive rate over precision). */
export interface FirewallRule {
  name: string;
  pattern: RegExp;
}

/** The built-in rule pack. Conservative, anchored phrases — not broad keywords. */
export const BUILTIN_FIREWALL_RULES: FirewallRule[] = [
  {
    name: "prompt_injection",
    pattern: /\b(ignore|disregard|forget|override)\b[^.?!]{0,40}\b(previous|prior|above|earlier|all)\b[^.?!]{0,20}\b(instructions?|prompts?|rules?|directions?)\b/i,
  },
  {
    name: "instruction_override",
    pattern: /\b(you are now|from now on you are|new (system )?instructions?\s*:|system\s*override|disregard your (system )?prompt)\b/i,
  },
  {
    name: "jailbreak",
    pattern: /\b(do anything now|\bDAN\b|developer mode|jailbreak|unfiltered mode|without any restrictions?|ignore your guidelines)\b/i,
  },
  {
    name: "recursive_expansion",
    pattern: /\b(repeat|print|expand|continue)\b[^.?!]{0,30}\b(forever|infinitely|recursively|without stopping|endlessly)\b/i,
  },
  {
    name: "system_prompt_extraction",
    pattern: /\b(reveal|show|print|repeat|output|display|leak|expose)\b[^.?!]{0,40}\b(system prompt|initial instructions?|your (system )?instructions?|the prompt above|hidden prompt)\b/i,
  },
  {
    name: "tool_manipulation",
    pattern: /\b(call|invoke|execute|run|trigger)\b[^.?!]{0,30}\b(tool|function|command|api)\b[^.?!]{0,30}\b(bypass|without (permission|authorization|approval)|ignoring)\b/i,
  },
  {
    name: "credential_exfiltration",
    pattern: /\b(reveal|print|show|leak|send|exfiltrate|email|upload)\b[^.?!]{0,30}\b(api[\s_-]?keys?|secrets?|passwords?|credentials?|access[\s_-]?tokens?|env(ironment)? variables?)\b/i,
  },
];

export class PromptFirewall implements ExecutionMiddleware {
  readonly name = "prompt-firewall";
  readonly priority = SECURITY_PRIORITY.firewall;

  constructor(
    private readonly bus: ExecutionEventBus,
    private readonly store: SecurityPolicyStore,
    private readonly rules: FirewallRule[] = BUILTIN_FIREWALL_RULES,
  ) {}

  interceptRequest(request: CompletionRequest, ctx: InferenceExecutionContext): CompletionRequest {
    const policy = this.store.current();
    if (!policy.enabled.firewall || policy.firewall.mode === "off") return request;

    const prompt = request.prompt ?? "";
    // Allow-list short-circuit: an explicitly allowed prompt is never blocked.
    if (policy.firewall.allowList.some((term) => term && prompt.includes(term))) {
      guard(() => this.bus.publish(promptInspected(ctx, "allowed", [])));
      return request;
    }

    const matched: string[] = [];
    for (const term of policy.firewall.denyList) {
      if (term && prompt.includes(term)) matched.push(`denylist:${term}`);
    }
    for (const rule of this.rules) {
      if (rule.pattern.test(prompt)) matched.push(rule.name);
    }

    if (matched.length === 0) {
      guard(() => this.bus.publish(promptInspected(ctx, "allowed", [])));
      return request;
    }

    if (policy.firewall.mode === "enforce") {
      guard(() => this.bus.publish(promptInspected(ctx, "rejected", matched)));
      throw new SecurityViolationError(`prompt firewall blocked request: ${matched.join(", ")}`);
    }

    // detect mode: flag but allow.
    guard(() => this.bus.publish(promptInspected(ctx, "flagged", matched)));
    return request;
  }
}
