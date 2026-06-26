// Phase 9 — integration adapter registry. Adapters self-register on import of
// register-integrations. Resolution fails closed for unknown providers.

import type { IntegrationAdapter, IntegrationProvider } from "./integration-types";

const registry = new Map<IntegrationProvider, IntegrationAdapter>();

export function registerIntegrationAdapter(adapter: IntegrationAdapter): void {
  registry.set(adapter.provider, adapter);
}

export function getIntegrationAdapter(provider: IntegrationProvider): IntegrationAdapter {
  const adapter = registry.get(provider);
  if (!adapter) {
    throw new Error(`No integration adapter registered for provider '${provider}' (fail-closed).`);
  }
  return adapter;
}

export function listIntegrationAdapters(): IntegrationAdapter[] {
  return [...registry.values()];
}

export function hasIntegrationAdapter(provider: IntegrationProvider): boolean {
  return registry.has(provider);
}
