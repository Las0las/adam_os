// IOS-008 — Batch Scheduler — Batch Queue.
//
// A pure data structure: groups pending requests by compatibility key. Each
// pending entry carries the execution context and a `release` callback that the
// coordinator invokes to let the request continue down the execution pipeline.
// No timers, no events, no provider calls — coordination lives in the coordinator.

import type { InferenceExecutionContext } from "@/lib/aiops/execution/execution-types";

/** Opaque timer handle (so the coordinator's clock can be injected for tests). */
export type TimerHandle = unknown;

/** One request awaiting dispatch. `release` resumes its pipeline (resolves its
 *  `resolveCompletion` with null, so it proceeds to security → provider). */
export interface PendingEntry {
  ctx: InferenceExecutionContext;
  release: () => void;
}

/** A forming batch of compatible requests. */
export interface BatchGroup {
  key: string;
  digest: string;
  entries: PendingEntry[];
  createdAt: number;
  timer: TimerHandle | null;
}

export class BatchQueue {
  private readonly groups = new Map<string, BatchGroup>();

  get(key: string): BatchGroup | undefined {
    return this.groups.get(key);
  }

  /** Open a new group for `key`. Caller SHALL push the first entry. */
  open(key: string, digest: string, createdAt: number): BatchGroup {
    const group: BatchGroup = { key, digest, entries: [], createdAt, timer: null };
    this.groups.set(key, group);
    return group;
  }

  delete(key: string): void {
    this.groups.delete(key);
  }

  /** Number of open (forming) batch groups. */
  size(): number {
    return this.groups.size;
  }

  /** Total pending requests across all groups. */
  pending(): number {
    let n = 0;
    for (const g of this.groups.values()) n += g.entries.length;
    return n;
  }

  all(): BatchGroup[] {
    return [...this.groups.values()];
  }
}
