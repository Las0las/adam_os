// Inference Execution Pipeline (Milestone 4.0/4.5, deliverables #2 + #5).
//
//   Inference Request → Routing Decision → Execution Context →
//   BeforeExecute hooks → Provider Execution → AfterExecute hooks → Response
//
// This is the ONLY component permitted to invoke a provider (`.complete()` is
// called nowhere else). Every inference flows through this single, deterministic
// lifecycle; capabilities attach via hooks rather than modifying providers or
// routing. No transport exception escapes — failures are normalized.
//
// Two entry points share the lifecycle:
//   - executeInference: resolves the adapter from the registry by a RoutingDecision.
//   - runModelCompletion: executes an already-resolved provider (the migration
//     path for callers that resolve via getModelProvider/resolveModelProvider);
//     returns the normalized CompletionResponse and throws a normalized
//     ExecutionError on failure.

import { id } from "@/lib/lawrence-core/utils/ids";
import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import type { CompletionRequest, CompletionResponse, ModelProvider } from "@/lib/aiops/models/model-provider";
import {
  ExecutionFailedError,
  ProviderUnavailableError,
  AuthenticationError,
  normalizeError,
  toNormalized,
  type ExecutionError,
} from "./execution-errors";
import { listExecutionHooks } from "./execution-hooks";
import type {
  ExecutionHook,
  InferenceExecutionContext,
  InferenceExecutionParams,
  InferenceExecutionResult,
} from "./execution-types";

function nowMs(): number {
  try {
    return Date.now();
  } catch {
    return 0;
  }
}

function successResult(ctx: InferenceExecutionContext, c: CompletionResponse): InferenceExecutionResult {
  return {
    executionId: ctx.executionId,
    provider: ctx.provider,
    model: ctx.model,
    response: c.text ?? null,
    json: c.json ?? null,
    usage: { promptTokens: c.promptTokens, completionTokens: c.completionTokens, costUsd: c.costUsd },
    latency: nowMs() - ctx.startTime,
    finishReason: "stop",
    success: true,
    error: null,
  };
}

function failure(ctx: InferenceExecutionContext, error: ExecutionError): InferenceExecutionResult {
  return {
    executionId: ctx.executionId,
    provider: ctx.provider,
    model: ctx.model,
    response: null,
    json: null,
    usage: null,
    latency: nowMs() - ctx.startTime,
    finishReason: null,
    success: false,
    error: toNormalized(error),
  };
}

interface LifecycleOutcome {
  result: InferenceExecutionResult;
  completion?: CompletionResponse;
  error?: ExecutionError;
}

/** Run the before-hooks → invoke → after/failed-hooks lifecycle. `invoke`
 *  performs the single permitted provider call and returns a CompletionResponse. */
async function runLifecycle(
  ctx: InferenceExecutionContext,
  hooks: ExecutionHook[],
  invoke: () => Promise<CompletionResponse>,
): Promise<LifecycleOutcome> {
  try {
    for (const h of hooks) await h.beforeExecute?.(ctx);
    const completion = await invoke();
    const result = deepFreeze(successResult(ctx, completion));
    for (const h of hooks) await h.afterExecute?.(ctx, result);
    return { result, completion };
  } catch (err) {
    const error = normalizeError(err);
    for (const h of hooks) await h.executionFailed?.(ctx, error);
    return { result: deepFreeze(failure(ctx, error)), error };
  }
}

/**
 * Execute one inference through the standard lifecycle, resolving the adapter
 * from the registry by the RoutingDecision. Always resolves with a normalized
 * result — it never rejects.
 */
export async function executeInference(
  params: InferenceExecutionParams,
  hooks: ExecutionHook[] = listExecutionHooks(),
): Promise<InferenceExecutionResult> {
  const { routingDecision } = params;
  const provider = routingDecision.selectedProvider ?? "";
  const model = routingDecision.selectedModel ?? "";

  const ctx: InferenceExecutionContext = deepFreeze({
    executionId: id("exec"),
    requestId: params.requestId,
    routingDecision,
    provider,
    model,
    tenantId: params.tenantId ?? null,
    workloadType: params.workloadType ?? "inference",
    startTime: nowMs(),
  });

  if (!routingDecision.selectedProvider || !routingDecision.selectedModel) {
    const error = new ExecutionFailedError("routing produced no eligible provider/model");
    for (const h of hooks) await h.executionFailed?.(ctx, error);
    return deepFreeze(failure(ctx, error));
  }

  const { result } = await runLifecycle(ctx, hooks, async () => {
    const entry = params.registry.get(provider);
    if (!entry) throw new ProviderUnavailableError(`provider not registered: ${provider}`);
    if (!entry.isConfigured()) {
      throw new AuthenticationError(`provider '${provider}' is not configured (credentials missing)`);
    }
    return entry.create(model).complete(params.request);
  });
  return result;
}

export interface RunModelCompletionOptions {
  /** A provider already resolved by the caller (getModelProvider / resolveModelProvider). */
  provider: ModelProvider;
  request: CompletionRequest;
  requestId?: string;
  tenantId?: string | null;
  workloadType?: string;
}

/**
 * Execute an already-resolved provider through the standard lifecycle. This is
 * the single sanctioned way for application/function code to invoke a provider:
 * it runs the hooks and normalizes errors, then returns the provider's
 * CompletionResponse unchanged (so existing callers are untouched). Throws a
 * normalized ExecutionError on failure.
 */
export async function runModelCompletion(
  opts: RunModelCompletionOptions,
  hooks: ExecutionHook[] = listExecutionHooks(),
): Promise<CompletionResponse> {
  const ctx: InferenceExecutionContext = deepFreeze({
    executionId: id("exec"),
    requestId: opts.requestId ?? id("req"),
    routingDecision: null,
    provider: opts.provider.provider,
    model: opts.provider.modelKey,
    tenantId: opts.tenantId ?? null,
    workloadType: opts.workloadType ?? "inference",
    startTime: nowMs(),
  });

  const { completion, error } = await runLifecycle(ctx, hooks, () => opts.provider.complete(opts.request));
  if (completion) return completion;
  throw error ?? new ExecutionFailedError("inference failed");
}
