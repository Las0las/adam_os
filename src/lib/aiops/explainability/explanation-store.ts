// IOS-015 — Explainability Engine — the in-memory Explanation store.
//
// Holds the most recent immutable Explanations (bounded). Read-only to consumers
// (Explainability surfaces, audits); the engine writes. No persistence beyond this
// store.

import type { Explanation } from "./explainability-types";

export class ExplanationStore {
  private readonly order: string[] = [];
  private readonly byId = new Map<string, Explanation>();
  private retain: number;

  constructor(retain = 100) {
    this.retain = Math.max(1, retain);
  }

  /** Adjust the retention bound (applied on the next insert). */
  setRetain(retain: number): void {
    this.retain = Math.max(1, retain);
  }

  /** Store an immutable Explanation, evicting the oldest beyond the bound. */
  set(explanation: Explanation): void {
    if (!this.byId.has(explanation.executionId)) this.order.push(explanation.executionId);
    this.byId.set(explanation.executionId, explanation);
    while (this.order.length > this.retain) {
      const evicted = this.order.shift();
      if (evicted !== undefined) this.byId.delete(evicted);
    }
  }

  get(executionId: string): Explanation | null {
    return this.byId.get(executionId) ?? null;
  }

  /** The most recent explanations (newest last). */
  recent(n = 20): Explanation[] {
    return this.order.slice(-n).map((id) => this.byId.get(id)!).filter(Boolean);
  }

  all(): Explanation[] {
    return this.order.map((id) => this.byId.get(id)!).filter(Boolean);
  }

  reset(): void {
    this.order.length = 0;
    this.byId.clear();
  }
}
