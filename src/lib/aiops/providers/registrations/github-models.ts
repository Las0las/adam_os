import { GitHubModelsProvider } from "@/lib/integrations/github/github-models-client";
import { defineProvider } from "../define-provider";
import type { ModelDescriptor } from "../provider-registry-types";

const P = "github_models";
// GitHub Models fronts many publishers; pricing is null (rate-limited, not billed).
function d(model: string, publisher: string, family: string, vision: boolean): ModelDescriptor {
  return {
    provider: P,
    publisher,
    family,
    model,
    version: null,
    contextWindow: 128_000,
    supportsVision: vision,
    supportsTools: true,
    supportsStreaming: true,
    supportsJSON: true,
    supportsReasoning: false,
    supportsEmbeddings: false,
    pricing: null,
    deprecated: false,
  };
}

export const githubModelsProvider = defineProvider({
  metadata: {
    id: P,
    vendor: "GitHub",
    displayName: "GitHub Models",
    authType: "bearer",
    endpoint: "https://models.github.ai/inference",
    supportsBatch: false,
    supportsStreaming: true,
  },
  descriptors: [
    d("openai/gpt-4o-mini", "openai", "gpt-4o", true),
    d("meta/Llama-3.3-70B-Instruct", "meta", "llama-3.3", false),
    d("mistral-ai/Mistral-Large-2411", "mistral-ai", "mistral-large", false),
  ],
  requiredEnv: [["GITHUB_MODELS_TOKEN"]],
  defaultPriority: 50,
  create: (modelKey) => new GitHubModelsProvider({ modelKey }),
  createDefault: () => new GitHubModelsProvider({ modelKey: process.env.LAWRENCE_DEFAULT_MODEL }),
});
