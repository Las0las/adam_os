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
}

export interface InferenceExecutionParams {
  request: CompletionRequest;
  routingDecision: RoutingDecision;
  registry: ProviderRegistry;
  requestId: string;
  tenantId?: string | null;
  workloadType?: string;
}
