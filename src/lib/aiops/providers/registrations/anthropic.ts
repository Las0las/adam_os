import { AnthropicModelProvider } from "@/lib/integrations/anthropic/anthropic-client";
import { defineProvider } from "../define-provider";
import type { ModelDescriptor } from "../provider-registry-types";

const P = "anthropic";
function d(model: string, family: string, inP: number, outP: number, reasoning: boolean): ModelDescriptor {
  return {
    provider: P,
    publisher: "anthropic",
    family,
    model,
    version: null,
    contextWindow: 200_000,
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsJSON: true,
    supportsReasoning: reasoning,
    supportsEmbeddings: false,
    pricing: { inputPerMTok: inP, outputPerMTok: outP },
    deprecated: false,
  };
}

export const anthropicProvider = defineProvider({
  metadata: {
    id: P,
    vendor: "Anthropic",
    displayName: "Anthropic",
    authType: "header-token", // x-api-key
    endpoint: "https://api.anthropic.com/v1/messages",
    supportsBatch: true,
    supportsStreaming: true,
  },
  descriptors: [
    d("claude-opus-4-8", "claude-opus", 5, 25, true),
    d("claude-sonnet-4-6", "claude-sonnet", 3, 15, true),
    d("claude-haiku-4-5", "claude-haiku", 1, 5, false),
  ],
  requiredEnv: [["ANTHROPIC_API_KEY"]],
  defaultPriority: 10,
  create: (modelKey) => new AnthropicModelProvider({ modelKey }),
  createDefault: () => new AnthropicModelProvider({ modelKey: process.env.LAWRENCE_DEFAULT_MODEL }),
});
