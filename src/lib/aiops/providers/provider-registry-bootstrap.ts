// Populates the process-wide provider registry with the five production
// providers. Importing this module (for its side effect) is step 3 of adding a
// provider — implement adapter, publish descriptors, register here. Idempotent:
// guarded so repeated imports don't double-register.

import { providerRegistry } from "./provider-registry";
import { anthropicProvider } from "./registrations/anthropic";
import { openaiProvider } from "./registrations/openai";
import { azureOpenAIProvider } from "./registrations/azure-openai";
import { googleProvider } from "./registrations/google";
import { githubModelsProvider } from "./registrations/github-models";

const ALL = [anthropicProvider, openaiProvider, azureOpenAIProvider, googleProvider, githubModelsProvider];

for (const provider of ALL) {
  if (!providerRegistry.has(provider.metadata.id)) {
    providerRegistry.register(provider);
  }
}

export { providerRegistry };
