// Inference Execution Pipeline (Milestone 4.0, deliverables #2 + #5).
//
//   Inference Request → Routing Decision → Execution Context →
//   BeforeExecute hooks → Provider Execution → AfterExecute hooks → Response
//
// This is the ONLY component permitted to invoke a provider. Every inference
// flows through this single, deterministic lifecycle; capabilities attach via
// hooks rather than modifying providers or routing. No transport exception
// escapes — failures are normalized and surfaced on the result.

import { id } from "@/lib/lawrence-core/utils/ids";
import { deepFreeze } from "@/lib/aiops/routing/routing-types";
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
  // Date.now is unavailable under the workflow sandbox but fine in app runtime;
  // guard so the pipeline is robust either way (latency falls back to 0).
  try {
    return Date.now();
  } catch {
    return 0;
  }
}

function failure(
  ctx: InferenceExecutionContext,
  error: ExecutionError,
): InferenceExecutionResult {
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

/**
 * Execute one inference through the standard lifecycle. Always resolves with an
 * InferenceExecutionResult (success or normalized failure) — it never rejects.
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

  // Routing produced nothing to execute.
  if (!routingDecision.selectedProvider || !routingDecision.selectedModel) {
    const error = new ExecutionFailedError("routing produced no eligible provider/model");
    await runFailed(hooks, ctx, error);
    return deepFreeze(failure(ctx, error));
  }

  try {
    await runBefore(hooks, ctx);

    const entry = params.registry.get(provider);
    if (!entry) {
      throw new ProviderUnavailableError(`provider not registered: ${provider}`);
    }
    if (!entry.isConfigured()) {
      throw new AuthenticationError(`provider '${provider}' is not configured (credentials missing)`);
    }

    const adapter = entry.create(model);
    const completion = await adapter.complete(params.request);

    const result: InferenceExecutionResult = {
      executionId: ctx.executionId,
      provider,
      model,
      response: completion.text ?? null,
      json: completion.json ?? null,
      usage: {
        promptTokens: completion.promptTokens,
        completionTokens: completion.completionTokens,
        costUsd: completion.costUsd,
      },
      latency: nowMs() - ctx.startTime,
      finishReason: "stop",
      success: true,
      error: null,
    };

    await runAfter(hooks, ctx, result);
    return deepFreeze(result);
  } catch (err) {
    const error = normalizeError(err);
    await runFailed(hooks, ctx, error);
    return deepFreeze(failure(ctx, error));
  }
}

async function runBefore(hooks: ExecutionHook[], ctx: InferenceExecutionContext): Promise<void> {
  for (const h of hooks) await h.beforeExecute?.(ctx);
}
async function runAfter(
  hooks: ExecutionHook[],
  ctx: InferenceExecutionContext,
  result: InferenceExecutionResult,
): Promise<void> {
  for (const h of hooks) await h.afterExecute?.(ctx, result);
}
async function runFailed(
  hooks: ExecutionHook[],
  ctx: InferenceExecutionContext,
  error: ExecutionError,
): Promise<void> {
  for (const h of hooks) await h.executionFailed?.(ctx, error);
}
