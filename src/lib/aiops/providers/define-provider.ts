// Helper to build a RegisteredProvider from declarative config. Env predicates
// read process.env lazily so configuration changes are always respected.

import type { ModelProvider } from "@/lib/aiops/models/model-provider";
import {
  envSatisfied,
  type ModelDescriptor,
  type ProviderMetadata,
  type RegisteredProvider,
} from "./provider-registry-types";

export interface ProviderDefinition {
  metadata: ProviderMetadata;
  descriptors: ModelDescriptor[];
  requiredEnv: string[][];
  extraDefaultEnv?: string[][];
  defaultPriority: number;
  create: (modelKey: string) => ModelProvider;
  createDefault: () => ModelProvider;
}

export function defineProvider(def: ProviderDefinition): RegisteredProvider {
  return {
    metadata: def.metadata,
    descriptors: def.descriptors,
    requiredEnv: def.requiredEnv,
    extraDefaultEnv: def.extraDefaultEnv,
    defaultPriority: def.defaultPriority,
    create: def.create,
    createDefault: def.createDefault,
    isConfigured: () => envSatisfied(def.requiredEnv),
    isDefaultEligible: () =>
      envSatisfied(def.requiredEnv) && envSatisfied(def.extraDefaultEnv ?? []),
  };
}
