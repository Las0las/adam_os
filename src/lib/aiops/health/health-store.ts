// IOS-013 — Provider Health Manager — the ProviderHealth store.
//
// Holds the latest immutable ProviderHealthSnapshot per provider+model. This is
// the canonical, read-only health source consumed by IOS-011 Circuit Breaker,
// IOS-012 Fallback, future Governed Routing, IOS-014 Benchmark Harness, IOS-015
// Explainability, IOS-020 SLA Manager, etc. Consumers READ snapshots; they SHALL
// NOT mutate them (snapshots are deep-frozen on publication).

import { healthKey, type ProviderHealthSnapshot } from "./health-types";

export class ProviderHealthStore {
  private readonly snapshots = new Map<string, ProviderHealthSnapshot>();

  /** The latest snapshot for a provider+model, or null if none observed. */
  get(provider: string, model: string): ProviderHealthSnapshot | null {
    return this.snapshots.get(healthKey(provider, model)) ?? null;
  }

  /** All current snapshots (a copy of the collection; the snapshots are frozen). */
  all(): ProviderHealthSnapshot[] {
    return [...this.snapshots.values()];
  }

  /** Replace the snapshot for its key. Internal to the manager. */
  set(snapshot: ProviderHealthSnapshot): void {
    this.snapshots.set(healthKey(snapshot.provider, snapshot.model), snapshot);
  }

  reset(): void {
    this.snapshots.clear();
  }
}
