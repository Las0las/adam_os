// Phase 4 — shared domain seed framework types (Part A1). A DomainSeedPack
// declares everything a vertical needs: ontology objects, functions, agents,
// actions, and notification rules. The seed runner installs it idempotently.

export interface DomainFunctionSeed {
  key: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  promptTemplateKey?: string;
  retrievalPolicyKey?: string;
  handlerKey: string;
}

export interface DomainAgentSeed {
  key: string;
  name: string;
  description: string;
  graph: Record<string, unknown>;
}

export interface DomainActionSeed {
  key: string;
  name: string;
  objectType?: string;
  handlerKey: string;
  inputSchema: Record<string, unknown>;
  approvalPolicyKey?: string;
}

export interface DomainNotificationRuleSeed {
  key: string;
  name: string;
  eventType: string;
  channel: "in_app" | "email" | "slack" | "teams";
  templateKey: string;
  template?: string;
  config: Record<string, unknown>;
}

export interface DomainObjectSeed {
  objectType: string;
  externalKey: string;
  title: string;
  status?: string;
  properties: Record<string, unknown>;
  /** Free-text evidence to chunk + index against this object. */
  evidence?: string[];
}

export interface DomainSeedPack {
  key: string;
  name: string;
  description: string;
  objectTypes: string[];
  functions: DomainFunctionSeed[];
  agents: DomainAgentSeed[];
  actions: DomainActionSeed[];
  notificationRules: DomainNotificationRuleSeed[];
  sampleObjects: DomainObjectSeed[];
}
