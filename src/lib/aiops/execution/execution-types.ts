// Inference Execution Pipeline — canonical types (Milestone 4.0).

import type { CompletionRequest, CompletionResponse } from "@/lib/aiops/models/model-provider";
import type { ProviderRegistry } from "@/lib/aiops/providers/provider-registry";
import type { RoutingDecision } from "@/lib/aiops/routing/routing-types";
import type { ExecutionError, NormalizedExecutionError } from "./execution-errors";

/** Immutable context that follows a request through execution (deliverable #1). */
export interface InferenceExecutionContext {
  executionId: string;
  requestId: string;
  /** The routing decision that produced this execution, or null for executions
   *  driven by an already-resolved provider (legacy resolution paths). */
  routingDecision: RoutingDecision | null;
  provider: string;
  model: string;
  tenantId: string | null;
  workloadType: string;
  startTime: number;
  /** Stable, non-cryptographic digest of the request (Milestone 5.0). Lets the
   *  audit middleware record request identity without retaining prompt text.
   *  Additive and observation-only — nothing in execution/routing reads it. */
  requestFingerprint: string;
}

export interface InferenceUsage {
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}

/** Normalized execution output (deliverable #4). No provider-specific response
 *  shape escapes the pipeline. */
export interface InferenceExecutionResult {
  executionId: string;
  provider: string;
  model: string;
  response: string | null;
  json: Record<string, unknown> | null;
  usage: InferenceUsage | null;
  latency: number;
  finishReason: string | null;
  success: boolean;
  error: NormalizedExecutionError | null;
}

/** Extension points (deliverable #3). Capabilities (telemetry, audit, health,
 *  and future firewall/caching/evaluation) attach here without modifying
 *  providers or routing. Hooks run in priority order (lower first; Milestone
 *  5.0), with registration order as a stable tie-break. */
export interface ExecutionHook {
  name: string;
  /** Lower runs earlier. Defaults to 0 when omitted (preserves prior ordering). */
  priority?: number;
  beforeExecute?(ctx: InferenceExecutionContext): void | Promise<void>;
  afterExecute?(ctx: InferenceExecutionContext, result: InferenceExecutionResult): void | Promise<void>;
  executionFailed?(ctx: InferenceExecutionContext, error: ExecutionError): void | Promise<void>;
  /**
   * Request interceptor (Milestone 6.0 — security middleware). Runs after the
   * BeforeExecute observation hooks and BEFORE the provider is invoked, in
   * priority order. It returns the request the provider should receive — either
   * the same request, or a transformed copy (e.g. PII-redacted). Throwing
   * rejects the execution (e.g. prompt firewall block) and no provider call is
   * made. Observation hooks (the event publisher) do NOT implement this — only
   * security middleware transform the request. It must never mutate the input
   * request object; return a new one to change it.
   */
  interceptRequest?(request: CompletionRequest, ctx: InferenceExecutionContext): CompletionRequest | Promise<CompletionRequest>;
  /**
   * Response interceptor (Milestone 6.0 — response validation). Runs after the
   * provider returns and BEFORE the AfterExecute observation hooks, in priority
   * order. It inspects/validates the response; throwing rejects the execution
   * (the result becomes a normalized failure). It must not mutate the response.
   */
  interceptResponse?(response: CompletionResponse, ctx: InferenceExecutionContext): void | Promise<void>;
  /**
   * Completion resolver (Milestone 7.0 — prompt cache). Runs FIRST in the
   * lifecycle — before the request interceptors and the provider — so it sees
   * the original request. Returning a CompletionResponse short-circuits the
   * provider (a cache hit); returning null continues normally. It NEVER bypasses
   * security: the request interceptors (firewall, PII) and the response
   * interceptor (validator) still run around a resolved response — only the
   * provider call is skipped.
   */
  resolveCompletion?(request: CompletionRequest, ctx: InferenceExecutionContext): CompletionResponse | null | Promise<CompletionResponse | null>;
  /**
   * Completion recorder (Milestone 7.0 — prompt cache). Runs after a FRESH
   * provider response passes the response interceptors (so failures and
   * invalid responses are never recorded). Not called when the response was
   * resolved from cache. Keyed on the original request.
   */
  recordCompletion?(request: CompletionRequest, response: CompletionResponse, ctx: InferenceExecutionContext): void | Promise<void>;
  /**
   * General provider-invocation middleware extension point (ADR-0003). This is a
   * permanent execution-middleware seam — NOT a retry-specific hook. A middleware
   * receives `next` (the downstream invocation chain, ultimately the provider)
   * and MAY call it zero, one, or many times, returning the response — covering
   * retry (IOS-010), circuit breaking (IOS-011), fallback (IOS-012), health
   * gating (IOS-013), and future execution-governance middleware. Hooks
   * implementing this compose as an onion in priority order (lowest priority =
   * outermost), with registration order as a stable tie-break — deterministic.
   * It wraps ONLY the provider call: it does not run when the response is
   * resolved from cache, and the request/response interceptors (security,
   * validation) still run around it, so it cannot bypass security or validation.
   * When no hook implements this, the pipeline invokes the provider exactly once
   * — behavior is byte-for-byte unchanged.
   */
  aroundInvoke?(
    request: CompletionRequest,
    ctx: InferenceExecutionContext,
    next: (request: CompletionRequest) => Promise<CompletionResponse>,
  ): Promise<CompletionResponse>;
}

export interface InferenceExecutionParams {
  request: CompletionRequest;
  routingDecision: RoutingDecision;
  registry: ProviderRegistry;
  requestId: string;
  tenantId?: string | null;
  workloadType?: string;
}
