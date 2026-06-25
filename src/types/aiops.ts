// LAWRENCE AIOps domain model. See spec §7.6, §25–§33, §40–§43.

import type { RetrievalHit } from "./dataops";

export interface AiFunction {
  id: string;
  tenantId: string;
  key: string;
  name: string;
  description?: string | null;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  promptTemplateId?: string | null;
  retrievalPolicyId?: string | null;
  writebackPolicyId?: string | null;
  status: "draft" | "active" | "archived";
  createdAt: string;
}

export interface AgentDefinition {
  id: string;
  tenantId: string;
  key: string;
  name: string;
  description?: string | null;
  graph: AgentGraph;
  status: "draft" | "active" | "archived";
  createdAt: string;
}

export interface AgentNode {
  id: string;
  kind:
    | "input"
    | "retrieve"
    | "function"
    | "condition"
    | "action"
    | "review"
    | "notify"
    | "output";
  config: Record<string, unknown>;
}

export interface AgentEdge {
  from: string;
  to: string;
  condition?: string | null;
}

export interface AgentGraph {
  nodes: AgentNode[];
  edges: AgentEdge[];
}

export interface FunctionRun {
  id: string;
  tenantId: string;
  functionId: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown> | null;
  citations?: RetrievalHit[];
  status: "queued" | "running" | "completed" | "failed";
  traceId?: string | null;
  error?: string | null;
  createdAt: string;
}

export interface AgentRun {
  id: string;
  tenantId: string;
  agentId: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown> | null;
  status: "queued" | "running" | "completed" | "failed";
  steps: AgentRunStep[];
  traceId?: string | null;
  error?: string | null;
  createdAt: string;
}

export interface AgentRunStep {
  nodeId: string;
  kind: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  startedAt: string;
  finishedAt: string;
}

export interface ModelDefinition {
  id: string;
  tenantId: string;
  provider: "openai" | "anthropic" | "google" | "azure_openai" | "other";
  modelKey: string;
  purpose: "chat" | "extraction" | "classification" | "embedding";
  config: Record<string, unknown>;
  status: "active" | "inactive";
}

export interface PromptTemplate {
  id: string;
  tenantId: string;
  key: string;
  name: string;
  template: string;
  outputSchema?: Record<string, unknown> | null;
  status: "draft" | "active" | "archived";
}

export interface EvalCase {
  id: string;
  tenantId: string;
  suiteType: "retrieval" | "extraction" | "response" | "recommendation";
  input: Record<string, unknown>;
  expected: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface EvalRun {
  id: string;
  tenantId: string;
  suiteType: EvalCase["suiteType"];
  results: EvalCaseResult[];
  score: number;
  createdAt: string;
}

export interface EvalCaseResult {
  caseId: string;
  passed: boolean;
  score: number;
  detail: Record<string, unknown>;
}

/** Trace record stored for every model interaction (§43 observability). */
export interface ModelTrace {
  id: string;
  tenantId: string;
  scope: "pipeline_run" | "function_run" | "agent_run" | "action" | "notification";
  scopeId: string;
  provider: string;
  modelKey: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  costUsd: number;
  retrievalMethod?: RetrievalHit["method"] | null;
  createdAt: string;
}
