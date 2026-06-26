import { GoogleModelProvider } from "@/lib/integrations/google/google-client";
import { defineProvider } from "../define-provider";
import type { ModelDescriptor } from "../provider-registry-types";

const P = "google";
function d(model: string, family: string, ctx: number, inP: number, outP: number): ModelDescriptor {
  return {
    provider: P,
    publisher: "google",
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

export const googleProvider = defineProvider({
  metadata: {
    id: P,
    vendor: "Google",
    displayName: "Google Gemini",
    authType: "header-token", // x-goog-api-key
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models",
    supportsBatch: false,
    supportsStreaming: true,
  },
  descriptors: [
    d("gemini-2.0-flash", "gemini-2.0", 1_048_576, 0.1, 0.4),
    d("gemini-1.5-pro", "gemini-1.5", 2_097_152, 1.25, 5),
    d("gemini-1.5-flash", "gemini-1.5", 1_048_576, 0.075, 0.3),
  ],
  requiredEnv: [["GOOGLE_API_KEY", "GEMINI_API_KEY"]],
  defaultPriority: 30,
  create: (modelKey) => new GoogleModelProvider({ modelKey }),
  createDefault: () => new GoogleModelProvider({ modelKey: process.env.LAWRENCE_DEFAULT_MODEL }),
});
