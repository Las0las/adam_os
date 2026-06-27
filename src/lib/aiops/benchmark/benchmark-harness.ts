// IOS-014 — Benchmark Harness.
//
// Drives benchmark cases THROUGH the existing public execution API: it asks the
// IOS-003 routing engine for a decision pinned to the target provider+model, then
// runs IOS-004 executeInference. It NEVER calls a provider's `.complete()`, never
// bypasses the pipeline, never mutates routing/the RoutingDecision/the Execution
// Plan, and never influences production routing. The policy MAY drop the
// retry/fallback/cache middleware for a run (via the hook list) — it does not
// mutate any global subsystem policy. Runs/results are immutable; events are
// published on the IOS-005 bus; correlation (retry/fallback/circuit) is read from
// the bus, and the health reference is a key into the IOS-013 store.

import { id } from "@/lib/lawrence-core/utils/ids";
import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import type { RoutingPolicy, RoutingRequest } from "@/lib/aiops/routing/routing-types";
import { route } from "@/lib/aiops/routing/routing-engine";
import type { ProviderRegistry } from "@/lib/aiops/providers/provider-registry";
import { executeInference } from "@/lib/aiops/execution/inference-pipeline";
import { listExecutionHooks } from "@/lib/aiops/execution/execution-hooks";
import type { ExecutionHook, InferenceExecutionResult } from "@/lib/aiops/execution/execution-types";
import { observedNowMs } from "@/lib/aiops/execution/observability/observability-clock";
import { guard } from "@/lib/aiops/execution/observability/execution-middleware";
import { isRetryEvent } from "@/lib/aiops/retry/retry-events";
import { isCircuitEvent } from "@/lib/aiops/circuit/circuit-events";
import { isFallbackEvent } from "@/lib/aiops/fallback/fallback-events";
import type { BusEvent, ExecutionEventBus, ExecutionEventSubscriber } from "@/lib/aiops/execution/observability/execution-event-bus";
import { scoreCase } from "./benchmark-scorer";
import {
  benchmarkRunStarted,
  benchmarkCaseStarted,
  benchmarkCaseCompleted,
  benchmarkCaseFailed,
  benchmarkRunCompleted,
  benchmarkRunFailed,
  type BenchmarkRunRef,
} from "./benchmark-events";
import type { BenchmarkResultStore } from "./benchmark-store";
import {
  benchmarkEligible,
  type BenchmarkCase,
  type BenchmarkPolicyStore,
  type BenchmarkResult,
  type BenchmarkRun,
  type BenchmarkSuite,
} from "./benchmark-types";

/** Correlates per-execution retry/circuit/fallback signals from the bus. */
class BenchmarkCorrelator implements ExecutionEventSubscriber {
  readonly name = "benchmark-correlator";
  private readonly m = new Map<string, { retry: number; fallback: boolean; circuit: string }>();
  private slot(execId: string) {
    let s = this.m.get(execId);
    if (!s) { s = { retry: 0, fallback: false, circuit: "unknown" }; this.m.set(execId, s); }
    return s;
  }
  onEvent(e: BusEvent): void {
    if (isRetryEvent(e)) {
      if (e.type === "retry.attempt") this.slot(e.executionId).retry += 1;
    } else if (isFallbackEvent(e)) {
      if (e.type === "fallback.started") this.slot(e.executionId).fallback = true;
    } else if (isCircuitEvent(e)) {
      const s = this.slot(e.executionId);
      s.circuit =
        e.type === "circuit.opened" || e.type === "circuit.rejected" ? "open"
        : e.type === "circuit.half_opened" ? "half_open"
        : e.type === "circuit.closed" ? "closed" : s.circuit;
    }
  }
  read(execId: string): { retry: number; fallback: boolean; circuit: string } {
    return this.m.get(execId) ?? { retry: 0, fallback: false, circuit: "unknown" };
  }
}

export interface BenchmarkRunContext {
  registry: ProviderRegistry;
  /** Base routing policy; the harness pins the target provider on top of it. */
  routingPolicy?: RoutingPolicy;
  /** Base execution hooks; defaults to the installed hooks. The policy's
   *  disable/bypass flags drop retry/fallback/cache from this list. */
  hooks?: ExecutionHook[];
}

export interface BenchmarkHarnessDeps {
  now?: () => number;
  newRunId?: () => string;
  /** Injectable execution entrypoint (defaults to the public pipeline). */
  execute?: typeof executeInference;
}

export class BenchmarkHarness {
  private readonly now: () => number;
  private readonly newRunId: () => string;
  private readonly execute: typeof executeInference;

  constructor(
    private readonly bus: ExecutionEventBus,
    private readonly store: BenchmarkResultStore,
    private readonly policyStore: BenchmarkPolicyStore,
    deps: BenchmarkHarnessDeps = {},
  ) {
    this.now = deps.now ?? observedNowMs;
    this.newRunId = deps.newRunId ?? (() => id("brun"));
    this.execute = deps.execute ?? executeInference;
  }

  /** Register an immutable suite for later execution / listing. */
  register(suite: BenchmarkSuite): BenchmarkSuite {
    return this.store.registerSuite(suite);
  }

  /**
   * Execute a suite against every eligible provider+model (one run each),
   * returning the immutable runs. A no-op when the policy is disabled.
   */
  async runSuite(suite: BenchmarkSuite, ctx: BenchmarkRunContext): Promise<BenchmarkRun[]> {
    const policy = this.policyStore.current();
    if (policy.mode !== "enabled") return [];

    const cases = suite.cases.slice(0, Math.max(0, policy.maxCasesPerRun));
    const baseHooks = ctx.hooks ?? listExecutionHooks();
    const hooks = baseHooks.filter((h) => {
      if (policy.disableRetry && h.name === "retry") return false;
      if (policy.disableFallback && h.name === "fallback-orchestrator") return false;
      if ((policy.bypassCache || policy.bypassSemanticCache) && h.name === "prompt-cache") return false;
      return true;
    });

    const correlator = new BenchmarkCorrelator();
    const unsubscribe = this.bus.subscribe(correlator);
    const runs: BenchmarkRun[] = [];
    try {
      for (const provider of suite.eligibleProviders) {
        for (const model of suite.eligibleModels) {
          if (!benchmarkEligible(policy, provider, model, suite.workloadType)) continue;
          runs.push(await this.runOne(suite, cases, provider, model, ctx, hooks, correlator));
        }
      }
    } finally {
      unsubscribe();
    }
    return runs;
  }

  private async runOne(
    suite: BenchmarkSuite,
    cases: BenchmarkCase[],
    provider: string,
    model: string,
    ctx: BenchmarkRunContext,
    hooks: ExecutionHook[],
    correlator: BenchmarkCorrelator,
  ): Promise<BenchmarkRun> {
    const runId = this.newRunId();
    const ref: BenchmarkRunRef = { runId, suiteId: suite.suiteId, provider, model, workloadType: suite.workloadType };
    const startedAt = this.now();
    guard(() => this.bus.publish(benchmarkRunStarted(ref, cases.length)));

    const results: BenchmarkResult[] = [];
    let status: BenchmarkRun["status"] = "completed";
    let successes = 0;
    try {
      for (const c of cases) {
        guard(() => this.bus.publish(benchmarkCaseStarted(ref, c.caseId)));
        const result = await this.runCase(suite, c, provider, model, ctx, hooks, correlator);
        results.push(result);
        if (result.success) {
          successes += 1;
          guard(() => this.bus.publish(benchmarkCaseCompleted(ref, c.caseId, result.normalizedScore, result.latencyMs)));
        } else {
          guard(() => this.bus.publish(benchmarkCaseFailed(ref, c.caseId, result.validationErrors[0] ?? result.executionOutcome)));
        }
      }
    } catch (err) {
      status = "failed";
      guard(() => this.bus.publish(benchmarkRunFailed(ref, err instanceof Error ? err.message : "benchmark run error")));
    }

    const run = deepFreeze({
      runId, suiteId: suite.suiteId, provider, model, workloadType: suite.workloadType,
      startedAt, endedAt: this.now(), status, results,
    });
    this.store.addRun(run);
    if (status === "completed") guard(() => this.bus.publish(benchmarkRunCompleted(ref, results.length, successes)));
    return run;
  }

  private async runCase(
    suite: BenchmarkSuite,
    c: BenchmarkCase,
    provider: string,
    model: string,
    ctx: BenchmarkRunContext,
    hooks: ExecutionHook[],
    correlator: BenchmarkCorrelator,
  ): Promise<BenchmarkResult> {
    const workloadType = c.workloadType ?? suite.workloadType;
    const healthSnapshotRef = `${provider}|${model}`;

    // Ask routing for a decision pinned to the target. Routing remains the sole
    // authority — if it does not select the target, the case is not eligible.
    const request: RoutingRequest = {
      workloadType,
      requiredCapabilities: c.requiredCapabilities,
      preferredProvider: provider,
      preferredModel: model,
      structuredOutputRequired: c.responseFormat === "json" ? true : undefined,
    };
    const pinned: RoutingPolicy = { ...(ctx.routingPolicy ?? {}), allowedProviders: [provider] };
    const decision = route(request, pinned, ctx.registry);

    if (decision.selectedProvider !== provider || decision.selectedModel !== model) {
      return deepFreeze({
        provider, model, workloadType, caseId: c.caseId,
        latencyMs: 0, tokenUsage: null, executionOutcome: "not_eligible",
        success: false, normalizedScore: 0,
        validationErrors: ["routing did not select the benchmark target"],
        retryCount: 0, fallbackOccurred: false, circuitBreakerState: "unknown", healthSnapshotRef,
      });
    }

    const result: InferenceExecutionResult = await this.execute(
      {
        request: {
          prompt: c.inputMessages.map((m) => `${m.role}: ${m.content}`).join("\n"),
          outputSchema: c.responseFormat === "json" ? c.expectedOutputShape ?? {} : null,
        },
        routingDecision: decision,
        registry: ctx.registry,
        requestId: `${suite.suiteId}:${c.caseId}`,
        tenantId: null,
        workloadType,
      },
      hooks,
    );

    const corr = correlator.read(result.executionId);
    const score = scoreCase(suite.scoringStrategy, c, { success: result.success, response: result.response, json: result.json });

    return deepFreeze({
      provider, model, workloadType, caseId: c.caseId,
      latencyMs: result.latency,
      tokenUsage: result.usage
        ? { prompt: result.usage.promptTokens, completion: result.usage.completionTokens, total: result.usage.promptTokens + result.usage.completionTokens }
        : null,
      executionOutcome: result.success ? "success" : "failure",
      success: result.success,
      normalizedScore: score,
      validationErrors: result.error ? [`${result.error.kind}: ${result.error.message}`] : [],
      retryCount: corr.retry,
      fallbackOccurred: corr.fallback,
      circuitBreakerState: corr.circuit,
      healthSnapshotRef,
    });
  }
}
