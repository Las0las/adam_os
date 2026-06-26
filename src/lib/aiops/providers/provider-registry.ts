// Provider Registry (Milestone 2.0). The single source of truth the router
// depends on: registration, lookup, provider enumeration, model enumeration.
//
// Registered providers are frozen on registration, and enumerations return
// frozen snapshots, so consumers cannot mutate the platform's source of truth.

import {
  assertValidDescriptor,
  type ModelDescriptor,
  type RegisteredProvider,
} from "./provider-registry-types";

export interface ProviderRegistry {
  /** Register a provider. Throws on a duplicate id or an invalid descriptor. */
  register(provider: RegisteredProvider): void;
  has(id: string): boolean;
  get(id: string): RegisteredProvider | undefined;
  /** All providers, sorted by defaultPriority then id (frozen snapshot). */
  list(): readonly RegisteredProvider[];
  /** Every published descriptor across all providers (frozen snapshot). */
  listModels(): readonly ModelDescriptor[];
  /** A descriptor by provider id + model key. */
  getModel(providerId: string, model: string): ModelDescriptor | undefined;
}

export function createProviderRegistry(): ProviderRegistry {
  const providers = new Map<string, RegisteredProvider>();

  return {
    register(provider: RegisteredProvider): void {
      const id = provider.metadata.id;
      if (providers.has(id)) {
        throw new Error(`Provider already registered: ${id}`);
      }
      provider.descriptors.forEach(assertValidDescriptor);
      // Freeze the published surface so it is immutable post-registration.
      provider.descriptors.forEach((d) => Object.freeze(d));
      Object.freeze(provider.descriptors);
      Object.freeze(provider.metadata);
      Object.freeze(provider);
      providers.set(id, provider);
    },

    has(id: string): boolean {
      return providers.has(id);
    },

    get(id: string): RegisteredProvider | undefined {
      return providers.get(id);
    },

    list(): readonly RegisteredProvider[] {
      const all = [...providers.values()].sort(
        (a, b) =>
          a.defaultPriority - b.defaultPriority || a.metadata.id.localeCompare(b.metadata.id),
      );
      return Object.freeze(all);
    },

    listModels(): readonly ModelDescriptor[] {
      const all: ModelDescriptor[] = [];
      for (const p of providers.values()) all.push(...p.descriptors);
      return Object.freeze(all);
    },

    getModel(providerId: string, model: string): ModelDescriptor | undefined {
      return providers.get(providerId)?.descriptors.find((d) => d.model === model);
    },
  };
}

/** The process-wide registry the application uses. Populated by importing
 *  `provider-registry-bootstrap`. */
export const providerRegistry = createProviderRegistry();
