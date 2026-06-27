// IOS-016 — Traffic Replay Engine.
//
// Replays recorded inputs THROUGH the public execution API: it asks the IOS-003
// routing engine for a decision pinned to the recorded target, then runs IOS-004
// executeInference with REPLAY-SCOPED hooks (a publisher bound to the replay bus).
// It NEVER invokes providers directly, mutates historical events / RoutingDecision
// / ExecutionPlan / ProviderHealth, or alters production routing. Because the only
// observation hooks are bound to the replay bus, production health (IOS-013) and
// production metrics never see replay events — isolation by construction. Every
// result is immutable and marked `isReplay: true`.

import { id } from "@/lib/lawrence-core/utils/ids";
import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import type { RoutingPolicy, RoutingRequest } from "@/lib/aiops/routing/routing-types";
import { route } from "@/lib/aiops/routing/routing-engine";
import type { ProviderRegistry } from "@/lib/aiops/providers/provider-registry";
import { executeInference } from "@/lib/aiops/execution/inference-pipeline";
import type { ExecutionHook, InferenceExecutionResult } from "@/lib/aiops/execution/execution-types";
import { ExecutionEventPublisher } from "@/lib/aiops/execution/observability/event-bus-publisher";
import { observedNowMs } from "@/lib/aiops/execution/observability/observability-clock";
import { guard } from "@/lib/aiops/execution/observability/execution-middleware";
import type { ExecutionEventBus } from "@/lib/aiops/execution/observability/execution-event-bus";
import {
  replayRunStarted,
  replayRecordStarted,
  replayRecordCompleted,
  replayRecordFailed,
  replayRunCompleted,
  type ReplayRunRef,
} from "./replay-events";
import type { ReplayStore } from "./replay-store";
import {
  REPLAY_TENANT,
  replayEligible,
  type ReplayPolicyStore,
  type ReplayRecord,
  type ReplayResult,
  type ReplayRun,
} from "./replay-types";

export interface ReplayContext {
  registry: ProviderRegistry;
  /** Base routing policy; the engine pins the recorded target on top of it. */
  routingPolicy?: RoutingPolicy;
  /** Extra REPLAY-SCOPED hooks (e.g. replay security/retry bound to the replay
   *  bus). The engine always adds its own replay publisher; it NEVER adds
   *  production hooks, so production observers never see replay events. */
  replayHooks?: ExecutionHook[];
}

export interface ReplayEngineDeps {
  now?: () => number;
  newReplayId?: () => string;
  execute?: typeof executeInference;
}

export class TrafficReplayEngine {
  private readonly now: () => number;
  private readonly newReplayId: () => string;
  private readonly execute: typeof executeInference;
  private readonly publisher: ExecutionEventPublisher;

  constructor(
    /** The REPLAY-SCOPED bus — isolated from the production observability bus. */
    private readonly replayBus: ExecutionEventBus,
    private readonly store: ReplayStore,
    private readonly policyStore: ReplayPolicyStore,
    deps: ReplayEngineDeps = {},
  ) {
    this.now = deps.now ?? observedNowMs;
    this.newReplayId = deps.newReplayId ?? (() => id("replay"));
    this.execute = deps.execute ?? executeInference;
    this.publisher = new ExecutionEventPublisher(replayBus);
  }

  register(record: ReplayRecord): ReplayRecord {
    return this.store.registerRecord(record);
  }

  /** Replay a set of records as one isolated run; returns the immutable run. */
  async replay(records: ReplayRecord[], ctx: ReplayContext): Promise<ReplayRun | null> {
    const policy = this.policyStore.current();
    if (policy.mode !== "enabled") return null;

    const replayId = this.newReplayId();
    const selected = records
      .filter((r) => replayEligible(policy, r.provider, r.model, r.workloadType))
      .slice(0, Math.max(0, policy.maxRecordsPerRun));
    // Observation is replay-scoped ONLY: production hooks are never included.
    const hooks: ExecutionHook[] = [this.publisher, ...(ctx.replayHooks ?? [])];

    const ref: ReplayRunRef = {
      replayId,
      provider: selected[0]?.provider ?? "",
      model: selected[0]?.model ?? "",
      workloadType: selected[0]?.workloadType ?? "replay",
    };
    const startedAt = this.now();
    guard(() => this.replayBus.publish(replayRunStarted(ref, selected.length)));

    const results: ReplayResult[] = [];
    let status: ReplayRun["status"] = "completed";
    let successes = 0;
    try {
      for (const record of selected) {
        guard(() => this.replayBus.publish(replayRecordStarted(ref, record.recordId)));
        const result = await this.replayOne(replayId, record, ctx, hooks);
        results.push(result);
        if (result.success) {
          successes += 1;
          guard(() => this.replayBus.publish(replayRecordCompleted(ref, record.recordId, result.latencyMs)));
        } else {
          guard(() => this.replayBus.publish(replayRecordFailed(ref, record.recordId, result.errorKind ?? result.executionOutcome)));
        }
      }
    } catch {
      status = "failed";
    }

    const run = deepFreeze({ replayId, startedAt, endedAt: this.now(), status, results });
    this.store.addRun(run);
    if (status === "completed") guard(() => this.replayBus.publish(replayRunCompleted(ref, results.length, successes)));
    return run;
  }

  private async replayOne(
    replayId: string,
    record: ReplayRecord,
    ctx: ReplayContext,
    hooks: ExecutionHook[],
  ): Promise<ReplayResult> {
    const baseResult = {
      replayId,
      recordId: record.recordId,
      sourceExecutionId: record.sourceExecutionId ?? null,
      provider: record.provider,
      model: record.model,
      workloadType: record.workloadType,
      isReplay: true as const,
    };

    // Ask routing for a decision pinned to the recorded target. Routing remains
    // authoritative; we never mutate the decision or alter production routing.
    const request: RoutingRequest = {
      workloadType: record.workloadType,
      requiredCapabilities: record.requiredCapabilities,
      preferredProvider: record.provider,
      preferredModel: record.model,
      structuredOutputRequired: record.responseFormat === "json" ? true : undefined,
    };
    const pinned: RoutingPolicy = { ...(ctx.routingPolicy ?? {}), allowedProviders: [record.provider] };
    const decision = route(request, pinned, ctx.registry);

    if (decision.selectedProvider !== record.provider || decision.selectedModel !== record.model) {
      return deepFreeze({
        ...baseResult,
        replayExecutionId: "",
        executionOutcome: "not_eligible",
        success: false,
        latencyMs: 0,
        tokenUsage: null,
        errorKind: "routing did not select the recorded target",
      });
    }

    const result: InferenceExecutionResult = await this.execute(
      {
        request: {
          prompt: record.inputMessages.map((m) => `${m.role}: ${m.content}`).join("\n"),
          outputSchema: record.responseFormat === "json" ? record.outputSchema ?? {} : null,
        },
        routingDecision: decision,
        registry: ctx.registry,
        requestId: `${replayId}:${record.recordId}`,
        tenantId: REPLAY_TENANT, // marks the execution (and its replay-bus events) as a replay
        workloadType: record.workloadType,
      },
      hooks,
    );

    return deepFreeze({
      ...baseResult,
      replayExecutionId: result.executionId,
      executionOutcome: result.success ? "success" : "failure",
      success: result.success,
      latencyMs: result.latency,
      tokenUsage: result.usage
        ? { prompt: result.usage.promptTokens, completion: result.usage.completionTokens, total: result.usage.promptTokens + result.usage.completionTokens }
        : null,
      errorKind: result.error ? result.error.kind : null,
    });
  }
}
