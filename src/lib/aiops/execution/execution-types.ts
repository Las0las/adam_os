// Inference Execution Pipeline — canonical types (Milestone 4.0).

import type { CompletionRequest } from "@/lib/aiops/models/model-provider";
import type { ProviderRegistry } from "@/lib/aiops/providers/provider-registry";
import type { RoutingDecision } from "@/lib/aiops/routing/routing-types";
import type { ExecutionError, NormalizedExecutionError } from "./execution-errors";

/** Immutable context that follows a request through execution (deliverable #1). */
export interface InferenceExecutionContext {
  executionId: string;
  requestId: string;
  routingDecision: RoutingDecision;
  provider: string;
  model: string;
  tenantId: string | null;
  workloadType: string;
  startTime: number;
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

/** Extension points (deliverable #3). Hooks perform no work in this milestone;
 *  future capabilities (telemetry, audit, firewall, caching, evaluation) attach
 *  here. Hooks run in registration order. */
export interface ExecutionHook {
  name: string;
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
