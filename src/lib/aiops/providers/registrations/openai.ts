import { OpenAIModelProvider } from "@/lib/integrations/openai/openai-client";
import { defineProvider } from "../define-provider";
import type { ModelDescriptor } from "../provider-registry-types";

const P = "openai";
function d(model: string, family: string, ctx: number, inP: number, outP: number): ModelDescriptor {
  return {
    provider: P,
    publisher: "openai",
    family,
    model,
    version: null,
    contextWindow: ctx,
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsJSON: true,
    supportsReasoning: false,
    supportsEmbeddings: false,
    pricing: { inputPerMTok: inP, outputPerMTok: outP },
    deprecated: false,
  };
}

export const openaiProvider = defineProvider({
  metadata: {
    id: P,
    vendor: "OpenAI",
    displayName: "OpenAI",
    authType: "bearer",
    endpoint: "https://api.openai.com/v1/chat/completions",
    supportsBatch: true,
    supportsStreaming: true,
  },
  descriptors: [
    d("gpt-4.1", "gpt-4.1", 1_047_576, 2, 8),
    d("gpt-4.1-mini", "gpt-4.1", 1_047_576, 0.4, 1.6),
    d("gpt-4o", "gpt-4o", 128_000, 2.5, 10),
  ],
  requiredEnv: [["OPENAI_API_KEY"]],
  defaultPriority: 20,
  create: (modelKey) => new OpenAIModelProvider({ modelKey }),
  createDefault: () => new OpenAIModelProvider({ modelKey: process.env.LAWRENCE_DEFAULT_MODEL }),
});
