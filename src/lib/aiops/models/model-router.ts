// Purpose-routed model resolution (§31–§32, §55). Two entry points:
//
//   resolveDefaultProvider()        — the process-wide default, chosen from the
//                                     environment. Installed into the global
//                                     model slot at bootstrap so every existing
//                                     getModelProvider() caller transparently
//                                     gets a real provider when a key is present.
//
//   resolveModelProvider(ctx, purpose) — per-tenant, per-purpose routing read
//                                     from db.modelDefinitions.
//
// Both are FAIL-CLOSED. If a tenant has authorized a real provider for a purpose
// but its API key is missing, we throw rather than silently using a different
// (unauthorized) model. When a tenant has authorized nothing for a purpose we
// fall back to the process default — which is the deterministic mock unless the
// operator has set a provider key, so local/test runs stay key-free.
//
// The router depends ONLY on the Provider Registry — no provider-specific
// imports or switch statements. Each provider declares its env requirements,
// default-selection priority, and adapter factory in its registration.

import { db } from "@/lib/lawrence-core/db";
import { MockModelProvider, getModelProvider, type ModelProvider } from "./model-provider";
import { providerRegistry } from "@/lib/aiops/providers/provider-registry-bootstrap";
import { describeRequiredEnv } from "@/lib/aiops/providers/provider-registry-types";
import type { ActorContext } from "@/types/platform";
import type { ModelDefinition } from "@/types/aiops";

/**
 * Choose the process default provider from the environment. Providers are tried
 * in registry priority order (Anthropic → OpenAI → Google → Azure → GitHub
 * Models); the first one whose env is configured wins, else the deterministic
 * mock (which keeps the platform fully runnable with no keys).
 */
export function resolveDefaultProvider(): ModelProvider {
  for (const provider of providerRegistry.list()) {
    if (provider.isDefaultEligible()) return provider.createDefault();
  }
  return new MockModelProvider();
}

/**
 * Build the provider a tenant has authorized for the given purpose. Throws if
 * the provider is unknown, or if its credentials are missing (fail-closed) — we
 * never quietly downgrade to a different model than the one the tenant
 * configured.
 */
export function providerFromDefinition(def: ModelDefinition): ModelProvider {
  const provider = providerRegistry.get(def.provider);
  if (!provider) {
    throw new Error(
      `No adapter for provider '${def.provider}' (model '${def.modelKey}'). ` +
        `Refusing to guess a substitute provider.`,
    );
  }
  if (!provider.isConfigured()) {
    throw new Error(
      `Tenant '${def.tenantId}' authorized ${provider.metadata.displayName} model ` +
        `'${def.modelKey}' for '${def.purpose}', but ${describeRequiredEnv(provider.requiredEnv)} ` +
        `is not set. Refusing to substitute another model.`,
    );
  }
  return provider.create(def.modelKey);
}

/**
 * Resolve the provider for a tenant + purpose. Falls back to the process default
 * when the tenant has authorized nothing for the purpose. Fail-closed on a
 * configured-but-unusable provider.
 */
export async function resolveModelProvider(
  ctx: ActorContext,
  purpose: ModelDefinition["purpose"],
): Promise<ModelProvider> {
  const defs = await db.modelDefinitions.list(
    ctx.tenantId,
    (d) => d.status === "active" && d.purpose === purpose,
  );
  const def = defs[0];
  if (!def) return getModelProvider();
  return providerFromDefinition(def);
}
