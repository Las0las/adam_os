// Unified Cache Platform (Milestone 7.5, deliverable #6) — CacheRegistry.
//
// The single place cache stores register. Future implementations (Semantic,
// Redis, Distributed, Replay, …) register here with no execution-pipeline
// changes. Registration order is preserved and is the default lookup order.

import type { CacheStore } from "./cache-store";

export class CacheRegistry {
  private readonly stores: CacheStore[] = [];

  /** Register a store. Re-registering the same name replaces it in place,
   *  preserving order; a new name appends (preserving registration order). */
  register(store: CacheStore): void {
    const i = this.stores.findIndex((s) => s.name === store.name);
    if (i >= 0) this.stores[i] = store;
    else this.stores.push(store);
  }

  /** All registered stores, in registration order (a copy). */
  list(): CacheStore[] {
    return [...this.stores];
  }

  /** Look up a store by name. */
  get(name: string): CacheStore | undefined {
    return this.stores.find((s) => s.name === name);
  }

  has(name: string): boolean {
    return this.stores.some((s) => s.name === name);
  }

  clear(): void {
    this.stores.length = 0;
  }
}
