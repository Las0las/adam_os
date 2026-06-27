// IOS-016 — Traffic Replay Engine — in-memory record registry + run store.
//
// Holds registered (immutable) replay records and completed (immutable) replay
// runs. In-memory only; isolated from production stores. Consumers read; the
// engine writes.

import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import type { ReplayRecord, ReplayRun } from "./replay-types";

export class ReplayStore {
  private readonly records = new Map<string, ReplayRecord>();
  private readonly runs: ReplayRun[] = [];

  registerRecord(record: ReplayRecord): ReplayRecord {
    const frozen = deepFreeze(record);
    this.records.set(frozen.recordId, frozen);
    return frozen;
  }

  getRecord(recordId: string): ReplayRecord | null {
    return this.records.get(recordId) ?? null;
  }

  allRecords(): ReplayRecord[] {
    return [...this.records.values()];
  }

  addRun(run: ReplayRun): void {
    this.runs.push(run);
  }

  getRun(replayId: string): ReplayRun | null {
    return this.runs.find((r) => r.replayId === replayId) ?? null;
  }

  allRuns(): ReplayRun[] {
    return [...this.runs];
  }

  reset(): void {
    this.records.clear();
    this.runs.length = 0;
  }
}
