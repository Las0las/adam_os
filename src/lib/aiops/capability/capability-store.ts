// IOS-018 — Model Capability Registry — the canonical capability store.
//
// Holds immutable ModelCapability records (and the ModelDescriptors they derive
// from) keyed by provider+model. Read-only to consumers; the registry writes.

import { capabilityKey, type ModelCapability, type ModelDescriptor } from "./capability-types";

export class ModelCapabilityStore {
  private readonly capabilities = new Map<string, ModelCapability>();
  private readonly descriptorsByKey = new Map<string, ModelDescriptor>();

  set(capability: ModelCapability, descriptor: ModelDescriptor): void {
    const key = capabilityKey(capability.provider, capability.model);
    this.capabilities.set(key, capability);
    this.descriptorsByKey.set(key, descriptor);
  }

  get(provider: string, model: string): ModelCapability | null {
    return this.capabilities.get(capabilityKey(provider, model)) ?? null;
  }

  /** The published ModelDescriptor metadata for a provider+model. */
  descriptor(provider: string, model: string): ModelDescriptor | null {
    return this.descriptorsByKey.get(capabilityKey(provider, model)) ?? null;
  }

  all(): ModelCapability[] {
    return [...this.capabilities.values()];
  }

  descriptors(): ModelDescriptor[] {
    return [...this.descriptorsByKey.values()];
  }

  byProvider(provider: string): ModelCapability[] {
    return this.all().filter((c) => c.provider === provider);
  }

  reset(): void {
    this.capabilities.clear();
    this.descriptorsByKey.clear();
  }
}
