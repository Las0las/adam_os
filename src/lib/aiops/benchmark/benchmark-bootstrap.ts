// IOS-014 — Benchmark Harness — wiring.
//
// Builds the process-wide Benchmark Harness, result store, and metrics collector,
// and subscribes the metrics collector to the bus. The harness is invoked on
// demand (it is NOT an execution hook and changes no execution behavior); the
// default policy is DISABLED, so runSuite is a no-op until a tenant enables it.

import { observability } from "@/lib/aiops/execution/observability/observability-bootstrap";
import { BenchmarkHarness } from "./benchmark-harness";
import { BenchmarkResultStore } from "./benchmark-store";
import { BenchmarkMetricsCollector } from "./benchmark-metrics";
import { BenchmarkPolicyStore, type BenchmarkPolicy } from "./benchmark-types";

export interface BenchmarkStack {
  policyStore: BenchmarkPolicyStore;
  store: BenchmarkResultStore;
  harness: BenchmarkHarness;
  metrics: BenchmarkMetricsCollector;
  installed: boolean;
}

const globalRef = globalThis as unknown as { __lawrenceBenchmark?: BenchmarkStack };

export function benchmarkPlatform(): BenchmarkStack {
  if (!globalRef.__lawrenceBenchmark) {
    const policyStore = new BenchmarkPolicyStore();
    const store = new BenchmarkResultStore();
    globalRef.__lawrenceBenchmark = {
      policyStore,
      store,
      harness: new BenchmarkHarness(observability().bus, store, policyStore),
      metrics: new BenchmarkMetricsCollector(),
      installed: false,
    };
  }
  return globalRef.__lawrenceBenchmark;
}

/**
 * Subscribe the benchmark metrics collector to the bus. Idempotent. Optionally
 * applies an initial policy. Returns the platform (harness + store + policy).
 */
export function installBenchmarkHarness(policy?: BenchmarkPolicy): BenchmarkStack {
  const stack = benchmarkPlatform();
  if (policy) stack.policyStore.configure(policy);
  if (!stack.installed) {
    observability().bus.subscribe(stack.metrics);
    stack.installed = true;
  }
  return stack;
}
