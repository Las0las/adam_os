// Inference Execution Pipeline — canonical types (Milestone 4.0).

import type { CompletionRequest } from "@/lib/aiops/models/model-provider";
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
}

export interface InferenceExecutionParams {
  request: CompletionRequest;
  routingDecision: RoutingDecision;
  registry: ProviderRegistry;
  requestId: string;
  tenantId?: string | null;
  workloadType?: string;
}
