// IOS-018 — Model Capability Registry — wiring.
//
// Exposes the process-wide canonical Model Capability Registry + store. It is
// declarative: installing it registers NO execution hook and changes no execution
// behavior — it is populated on demand from the published provider declarations
// (buildFrom) and optionally enriched with benchmark/evaluation observations.
// Routing is unaffected; it keeps consuming capability metadata through the
// existing IOS-001/002 contracts.

import { ModelCapabilityRegistry } from "./capability-registry";
import { ModelCapabilityStore } from "./capability-store";

export interface CapabilityStack {
  store: ModelCapabilityStore;
  registry: ModelCapabilityRegistry;
}

const globalRef = globalThis as unknown as { __lawrenceCapability?: CapabilityStack };

export function capabilityPlatform(): CapabilityStack {
  if (!globalRef.__lawrenceCapability) {
    const store = new ModelCapabilityStore();
    globalRef.__lawrenceCapability = { store, registry: new ModelCapabilityRegistry(store) };
  }
  return globalRef.__lawrenceCapability;
}

/** Install the canonical Model Capability Registry singleton (idempotent). */
export function installModelCapabilityRegistry(): CapabilityStack {
  return capabilityPlatform();
}

/** The read-only canonical capability store (for consumers). */
export function modelCapabilityStore(): ModelCapabilityStore {
  return capabilityPlatform().store;
}
