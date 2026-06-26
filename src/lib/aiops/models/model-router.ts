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

import { db } from "@/lib/lawrence-core/db";
import {
  MockModelProvider,
  getModelProvider,
  type ModelProvider,
} from "./model-provider";
import { AnthropicModelProvider } from "@/lib/integrations/anthropic/anthropic-client";
import { OpenAIModelProvider } from "@/lib/integrations/openai/openai-client";
import { GoogleModelProvider } from "@/lib/integrations/google/google-client";
import { AzureOpenAIModelProvider } from "@/lib/integrations/azure/azure-openai-client";
import { GitHubModelsProvider } from "@/lib/integrations/github/github-models-client";
import type { ActorContext } from "@/types/platform";
import type { ModelDefinition } from "@/types/aiops";

/**
 * Choose the process default provider from the environment. Preference order:
 * Anthropic → OpenAI → Google → deterministic mock. The mock default keeps the
 * platform fully runnable with no keys (tests, local, CI).
 */
export function resolveDefaultProvider(): ModelProvider {
  if (process.env.ANTHROPIC_API_KEY) {
    return new AnthropicModelProvider({ modelKey: process.env.LAWRENCE_DEFAULT_MODEL });
  }
  if (process.env.OPENAI_API_KEY) {
    return new OpenAIModelProvider({ modelKey: process.env.LAWRENCE_DEFAULT_MODEL });
  }
  if (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY) {
    return new GoogleModelProvider({ modelKey: process.env.LAWRENCE_DEFAULT_MODEL });
  }
  if (
    process.env.AZURE_OPENAI_API_KEY &&
    process.env.AZURE_OPENAI_ENDPOINT &&
    (process.env.AZURE_OPENAI_DEPLOYMENT || process.env.LAWRENCE_DEFAULT_MODEL)
  ) {
    return new AzureOpenAIModelProvider({
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT || process.env.LAWRENCE_DEFAULT_MODEL,
    });
  }
  // Keyed on the DEDICATED GITHUB_MODELS_TOKEN (never the ubiquitous GITHUB_TOKEN)
  // so it can't activate by accident in CI/Actions.
  if (process.env.GITHUB_MODELS_TOKEN) {
    return new GitHubModelsProvider({ modelKey: process.env.LAWRENCE_DEFAULT_MODEL });
  }
  return new MockModelProvider();
}

/**
 * Build the provider a tenant has authorized for the given purpose. Throws if
 * the authorized provider's key is missing (fail-closed) — we never quietly
 * downgrade to a different model than the one the tenant configured.
 */
export function providerFromDefinition(def: ModelDefinition): ModelProvider {
  switch (def.provider) {
    case "anthropic":
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error(
          `Tenant '${def.tenantId}' authorized Anthropic model '${def.modelKey}' for ` +
            `'${def.purpose}', but ANTHROPIC_API_KEY is not set. Refusing to substitute ` +
            `another model.`,
        );
      }
      return new AnthropicModelProvider({ modelKey: def.modelKey });
    case "openai":
      if (!process.env.OPENAI_API_KEY) {
        throw new Error(
          `Tenant '${def.tenantId}' authorized OpenAI model '${def.modelKey}' for ` +
            `'${def.purpose}', but OPENAI_API_KEY is not set. Refusing to substitute ` +
            `another model.`,
        );
      }
      return new OpenAIModelProvider({ modelKey: def.modelKey });
    case "azure_openai":
      // The deployment name is def.modelKey; Azure has its own endpoint + auth.
      if (!process.env.AZURE_OPENAI_API_KEY || !process.env.AZURE_OPENAI_ENDPOINT) {
        throw new Error(
          `Tenant '${def.tenantId}' authorized Azure OpenAI deployment '${def.modelKey}' for ` +
            `'${def.purpose}', but AZURE_OPENAI_API_KEY / AZURE_OPENAI_ENDPOINT are not set. ` +
            `Refusing to substitute another model.`,
        );
      }
      return new AzureOpenAIModelProvider({ deployment: def.modelKey });
    case "google":
      if (!process.env.GOOGLE_API_KEY && !process.env.GEMINI_API_KEY) {
        throw new Error(
          `Tenant '${def.tenantId}' authorized Google model '${def.modelKey}' for ` +
            `'${def.purpose}', but GOOGLE_API_KEY (or GEMINI_API_KEY) is not set. Refusing ` +
            `to substitute another model.`,
        );
      }
      return new GoogleModelProvider({ modelKey: def.modelKey });
    case "github_models":
      if (!process.env.GITHUB_MODELS_TOKEN) {
        throw new Error(
          `Tenant '${def.tenantId}' authorized GitHub Models '${def.modelKey}' for ` +
            `'${def.purpose}', but GITHUB_MODELS_TOKEN is not set. Refusing to substitute ` +
            `another model.`,
        );
      }
      return new GitHubModelsProvider({ modelKey: def.modelKey });
    default:
      throw new Error(
        `No adapter for provider '${def.provider}' (model '${def.modelKey}'). ` +
          `Refusing to guess a substitute provider.`,
      );
  }
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
