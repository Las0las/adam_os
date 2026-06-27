// IOS-014 — Benchmark Harness — in-memory suite registry + result store.
//
// Holds registered (immutable) suites and completed (immutable) runs. This is the
// ONLY persistence (in-memory; no external store). Consumers read; the harness
// writes. No persistence beyond this store (out of scope).

import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import type { BenchmarkRun, BenchmarkSuite } from "./benchmark-types";

export class BenchmarkResultStore {
  private readonly suites = new Map<string, BenchmarkSuite>();
  private readonly runs: BenchmarkRun[] = [];

  /** Register an immutable suite (deep-frozen). */
  registerSuite(suite: BenchmarkSuite): BenchmarkSuite {
    const frozen = deepFreeze(suite);
    this.suites.set(frozen.suiteId, frozen);
    return frozen;
  }

  getSuite(suiteId: string): BenchmarkSuite | null {
    return this.suites.get(suiteId) ?? null;
  }

  allSuites(): BenchmarkSuite[] {
    return [...this.suites.values()];
  }

  /** Record a completed run (already immutable). */
  addRun(run: BenchmarkRun): void {
    this.runs.push(run);
  }

  getRun(runId: string): BenchmarkRun | null {
    return this.runs.find((r) => r.runId === runId) ?? null;
  }

  runsForSuite(suiteId: string): BenchmarkRun[] {
    return this.runs.filter((r) => r.suiteId === suiteId);
  }

  allRuns(): BenchmarkRun[] {
    return [...this.runs];
  }

  reset(): void {
    this.suites.clear();
    this.runs.length = 0;
  }
}
