// IOS-016 — Traffic Replay Engine — wiring.
//
// Builds the process-wide replay platform around a DEDICATED replay event bus
// (NOT the production observability bus). Replay-scoped observers — a replay
// Explainability Engine + Explanation store (so replays are explainable through
// the same infrastructure) and replay metrics — subscribe to the REPLAY bus only.
// Nothing here subscribes to the production bus, so replay can never contaminate
// production health (IOS-013) or production metrics. The default policy is
// DISABLED, so the engine is a no-op until enabled.

import { ExecutionEventBus } from "@/lib/aiops/execution/observability/execution-event-bus";
import { ExplainabilityEngine } from "@/lib/aiops/explainability/explainability-engine";
import { ExplanationStore } from "@/lib/aiops/explainability/explanation-store";
import { ExplainabilityPolicyStore, defaultExplainabilityPolicy } from "@/lib/aiops/explainability/explainability-types";
import { TrafficReplayEngine } from "./replay-engine";
import { ReplayStore } from "./replay-store";
import { ReplayMetricsCollector } from "./replay-metrics";
import { ReplayPolicyStore, type ReplayPolicy } from "./replay-types";

export interface ReplayStack {
  /** The isolated replay bus. */
  bus: ExecutionEventBus;
  policyStore: ReplayPolicyStore;
  store: ReplayStore;
  engine: TrafficReplayEngine;
  metrics: ReplayMetricsCollector;
  /** Replay-scoped explanations (isolated from production explanations). */
  explanations: ExplanationStore;
  installed: boolean;
}

const globalRef = globalThis as unknown as { __lawrenceReplay?: ReplayStack };

export function replayPlatform(): ReplayStack {
  if (!globalRef.__lawrenceReplay) {
    const bus = new ExecutionEventBus();
    const policyStore = new ReplayPolicyStore();
    const store = new ReplayStore();
    const explanations = new ExplanationStore();
    globalRef.__lawrenceReplay = {
      bus,
      policyStore,
      store,
      engine: new TrafficReplayEngine(bus, store, policyStore),
      metrics: new ReplayMetricsCollector(),
      explanations,
      installed: false,
    };
  }
  return globalRef.__lawrenceReplay;
}

/**
 * Subscribe the replay-scoped observers to the REPLAY bus. Idempotent. Optionally
 * applies an initial policy. The replay Explainability Engine is enabled within
 * the replay scope so replays are explainable in isolation.
 */
export function installTrafficReplay(policy?: ReplayPolicy): ReplayStack {
  const stack = replayPlatform();
  if (policy) stack.policyStore.configure(policy);
  if (!stack.installed) {
    const explainPolicy = new ExplainabilityPolicyStore({ ...defaultExplainabilityPolicy(), mode: "enabled" });
    stack.bus.subscribe(new ExplainabilityEngine(stack.bus, stack.explanations, explainPolicy));
    stack.bus.subscribe(stack.metrics);
    stack.installed = true;
  }
  return stack;
}
