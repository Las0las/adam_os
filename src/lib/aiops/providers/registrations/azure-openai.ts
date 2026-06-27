import { AzureOpenAIModelProvider } from "@/lib/integrations/azure/azure-openai-client";
import { defineProvider } from "../define-provider";
import type { ModelDescriptor } from "../provider-registry-types";

const P = "azure_openai";
// Descriptors describe the underlying models deployable on Azure OpenAI; the
// actual invocation key is the customer's deployment name (def.modelKey).
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

export const azureOpenAIProvider = defineProvider({
  metadata: {
    id: P,
    vendor: "Microsoft",
    displayName: "Azure OpenAI",
    authType: "api-key",
    endpoint: "https://{resource}.openai.azure.com",
    supportsBatch: true,
    supportsStreaming: true,
  },
  descriptors: [
    d("gpt-4o", "gpt-4o", 128_000, 2.5, 10),
    d("gpt-4.1-mini", "gpt-4.1", 1_047_576, 0.4, 1.6),
  ],
  requiredEnv: [["AZURE_OPENAI_API_KEY"], ["AZURE_OPENAI_ENDPOINT"]],
  extraDefaultEnv: [["AZURE_OPENAI_DEPLOYMENT", "LAWRENCE_DEFAULT_MODEL"]],
  defaultPriority: 40,
  create: (modelKey) => new AzureOpenAIModelProvider({ deployment: modelKey }),
  createDefault: () =>
    new AzureOpenAIModelProvider({
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT || process.env.LAWRENCE_DEFAULT_MODEL,
    }),
});
