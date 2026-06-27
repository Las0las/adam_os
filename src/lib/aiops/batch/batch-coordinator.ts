// IOS-008 — Batch Scheduler — Batch Coordinator.
//
// Owns queue management, timeout handling, batch dispatch, and result
// distribution. Dispatch occurs when a group reaches `maxBatchSize` (reason
// "size") or when its wait timer fires (reason "timeout"). On dispatch the
// coordinator releases every entry, which resumes each request's pipeline so it
// proceeds — individually and in order — through security and the provider. The
// coordinator guarantees each request receives its own response (it never
// reorders or merges responses; releasing only controls timing). Clock and timer
// are injectable so behavior is deterministic in tests.

import {
  BatchQueue,
  type BatchGroup,
  type PendingEntry,
  type TimerHandle,
} from "./batch-queue";
import type { BatchPolicy } from "./batch-types";

export type DispatchReason = "size" | "timeout";

export interface CoordinatorCallbacks {
  onCreated(group: BatchGroup): void;
  onQueued(group: BatchGroup, entry: PendingEntry, position: number): void;
  onDispatched(group: BatchGroup, reason: DispatchReason, waitMs: number): void;
}

export interface CoordinatorDeps {
  policy(): BatchPolicy;
  now(): number;
  setTimer(fn: () => void, ms: number): TimerHandle;
  clearTimer(handle: TimerHandle): void;
  callbacks: CoordinatorCallbacks;
}

export class BatchCoordinator {
  private readonly queue = new BatchQueue();

  constructor(private readonly deps: CoordinatorDeps) {}

  /** Enqueue a request; may dispatch synchronously when the size bound is hit. */
  enqueue(key: string, digest: string, entry: PendingEntry): void {
    const policy = this.deps.policy();
    let group = this.queue.get(key);
    const isNew = group === undefined;
    if (!group) group = this.queue.open(key, digest, this.deps.now());
    group.entries.push(entry);
    if (isNew) this.deps.callbacks.onCreated(group);
    this.deps.callbacks.onQueued(group, entry, group.entries.length);

    if (group.entries.length >= Math.max(1, policy.maxBatchSize)) {
      this.dispatch(key, "size");
    } else if (group.entries.length === 1) {
      group.timer = this.deps.setTimer(() => this.dispatch(key, "timeout"), policy.maxWaitMs);
    }
  }

  private dispatch(key: string, reason: DispatchReason): void {
    const group = this.queue.get(key);
    if (!group || group.entries.length === 0) return;
    if (group.timer != null) this.deps.clearTimer(group.timer);
    this.queue.delete(key);
    const waitMs = this.deps.now() - group.createdAt;
    // Announce the dispatch BEFORE releasing, so batch events precede the
    // per-request provider/completion events.
    this.deps.callbacks.onDispatched(group, reason, waitMs);
    for (const entry of group.entries) entry.release();
  }

  /** Dispatch all forming batches immediately (timeout reason). For shutdown or
   *  deterministic test draining. */
  flush(): void {
    for (const group of this.queue.all()) this.dispatch(group.key, "timeout");
  }

  /** Total pending (held) requests. */
  pending(): number {
    return this.queue.pending();
  }
}
