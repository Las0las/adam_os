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
import { fingerprint } from "./observability/fingerprint";
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
import { buildExecutionPlan, planContains } from "@/lib/aiops/routing/execution-plan";
import type { ExecutionPlan, ExecutionTarget } from "@/lib/aiops/routing/routing-types";
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

/**
 * Run the standard lifecycle:
 *   BeforeExecute (observe) → resolveCompletion (cache lookup) →
 *     interceptRequest (security: inspect/redact/reject) →
 *     provider OR cached response → interceptResponse (validate/reject) →
 *     recordCompletion (cache store, fresh only) → AfterExecute (observe)
 *
 * `resolveCompletion` (the prompt cache) runs first, on the ORIGINAL request, and
 * may short-circuit the provider with a cached response — but it NEVER bypasses
 * security: the request interceptors (firewall, PII) and the response interceptor
 * (validator) still run around a cached response; only the provider call is
 * skipped. `interceptRequest` folds the request (each returns the request the
 * next sees), so a security middleware can hand the provider a transformed (e.g.
 * PII-redacted) request; the caller's original request object is never mutated.
 * A fresh (non-cached) response that passes validation is offered to
 * `recordCompletion` — failures and invalid responses are never recorded. When
 * no hook implements these (the common case), the request reaches `invoke`
 * unchanged and behavior is identical to before Milestones 6.0/7.0.
 */
async function runLifecycle(
  ctx: InferenceExecutionContext,
  hooks: ExecutionHook[],
  request: CompletionRequest,
  invoke: (request: CompletionRequest, target?: ExecutionTarget) => Promise<CompletionResponse>,
): Promise<LifecycleOutcome> {
  try {
    for (const h of hooks) await h.beforeExecute?.(ctx);
    // Cache lookup: first non-null short-circuits the provider (a cache hit).
    let resolved: CompletionResponse | null = null;
    for (const h of hooks) {
      if (h.resolveCompletion) {
        const hit = await h.resolveCompletion(request, ctx);
        if (hit) { resolved = hit; break; }
      }
    }
    // Security/request transforms still run, even on a cache hit.
    let effectiveRequest = request;
    for (const h of hooks) {
      if (h.interceptRequest) effectiveRequest = await h.interceptRequest(effectiveRequest, ctx);
    }
    // Provider invocation, wrapped by any aroundInvoke middleware (ADR-0003).
    // Composed as an onion in priority order (lowest priority = outermost). When
    // no hook implements aroundInvoke, this reduces to a single invoke() call —
    // identical to the prior behavior. Skipped entirely on a cache hit (no
    // provider call), so retry/resilience only wraps real provider calls.
    let completion: CompletionResponse;
    if (resolved) {
      completion = resolved;
    } else {
      // Each layer's `next` threads any execution-target override (ADR-0004)
      // down to the provider: a target supplied by an OUTER middleware flows
      // through inner layers (which call `next` with no target) unchanged, while
      // an inner middleware that supplies its own target takes precedence
      // (`thisTarget ?? outerTarget`). With no override anywhere, `target` stays
      // undefined and the primary plan target is invoked exactly once.
      let chain: (req: CompletionRequest, target?: ExecutionTarget) => Promise<CompletionResponse> =
        (req, target) => invoke(req, target);
      const around = hooks.filter((h) => h.aroundInvoke);
      for (let i = around.length - 1; i >= 0; i--) {
        const h = around[i]!;
        const inner = chain;
        chain = (req, outerTarget) =>
          h.aroundInvoke!(req, ctx, (r, thisTarget) => inner(r, thisTarget ?? outerTarget));
      }
      completion = await chain(effectiveRequest);
    }
    // Response validation runs on cached and fresh responses alike.
    for (const h of hooks) {
      if (h.interceptResponse) await h.interceptResponse(completion, ctx);
    }
    // Record only fresh, validated responses (never cache hits or failures).
    if (!resolved) {
      for (const h of hooks) {
        if (h.recordCompletion) await h.recordCompletion(request, completion, ctx);
      }
    }
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

  // The routing-authorized Execution Plan travels with the context (ADR-0004).
  // Execution reads it; it never builds, authorizes, or extends alternate targets.
  const executionPlan = buildExecutionPlan(routingDecision);

  const ctx: InferenceExecutionContext = deepFreeze({
    executionId: id("exec"),
    requestId: params.requestId,
    routingDecision,
    provider,
    model,
    tenantId: params.tenantId ?? null,
    workloadType: params.workloadType ?? "inference",
    startTime: nowMs(),
    requestFingerprint: fingerprint(params.request),
    executionPlan,
  });

  if (!routingDecision.selectedProvider || !routingDecision.selectedModel) {
    const error = new ExecutionFailedError("routing produced no eligible provider/model");
    for (const h of hooks) await h.executionFailed?.(ctx, error);
    return deepFreeze(failure(ctx, error));
  }

  const { result } = await runLifecycle(ctx, hooks, params.request, async (req, target) => {
    // Resolve the execution target (ADR-0004). With no override, this is the
    // primary (routing-selected) target — unchanged. An override may name only a
    // target CONTAINED in the immutable Execution Plan the routing layer
    // authorized; routing is never re-run and the RoutingDecision is never mutated.
    let invProvider = provider;
    let invModel = model;
    if (target) {
      if (!planContains(executionPlan, target)) {
        throw new ProviderUnavailableError(
          `execution target not in the authorized execution plan: ${target.provider}|${target.model}`,
        );
      }
      invProvider = target.provider;
      invModel = target.model;
    }
    const entry = params.registry.get(invProvider);
    if (!entry) throw new ProviderUnavailableError(`provider not registered: ${invProvider}`);
    if (!entry.isConfigured()) {
      throw new AuthenticationError(`provider '${invProvider}' is not configured (credentials missing)`);
    }
    return entry.create(invModel).complete(req);
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
  // No routing here: the only authorized target is the already-resolved provider.
  // The plan is that single target, so no alternate override can be selected.
  const executionPlan: ExecutionPlan = {
    targets: [{ provider: opts.provider.provider, model: opts.provider.modelKey }],
  };

  const ctx: InferenceExecutionContext = deepFreeze({
    executionId: id("exec"),
    requestId: opts.requestId ?? id("req"),
    routingDecision: null,
    provider: opts.provider.provider,
    model: opts.provider.modelKey,
    tenantId: opts.tenantId ?? null,
    workloadType: opts.workloadType ?? "inference",
    startTime: nowMs(),
    requestFingerprint: fingerprint(opts.request),
    executionPlan,
  });

  const { completion, error } = await runLifecycle(ctx, hooks, opts.request, (req, target) => {
    // The plan contains only the resolved provider (no RoutingDecision). An
    // override naming any other target is not in the plan — reject it (ADR-0004).
    if (target && !planContains(executionPlan, target)) {
      throw new ProviderUnavailableError("execution target not in the authorized execution plan");
    }
    return opts.provider.complete(req);
  });
  if (completion) return completion;
  throw error ?? new ExecutionFailedError("inference failed");
}
