// The LAWRENCE in-memory database: one tenant-scoped Collection per table
// from the §46 schema outline. A single module-level singleton stands in for
// the Postgres operational store during this Phase-1 foundation.

import { Collection } from "./collection";
import type { Role, Tenant, User, AuditEvent } from "@/types/platform";
import type {
  Source,
  RawAsset,
  PipelineDefinition,
  PipelineRun,
  CanonicalDocument,
  CanonicalRecord,
  EvidenceChunk,
  OntologyObject,
  OntologyLink,
  LineageEvent,
} from "@/types/dataops";
import type {
  AiFunction,
  AgentDefinition,
  PromptTemplate,
  ModelDefinition,
  FunctionRun,
  AgentRun,
  EvalCase,
  EvalRun,
  ModelTrace,
} from "@/types/aiops";
import type {
  ActionDefinition,
  ActionExecution,
  ReviewCase,
  ReviewCaseEvent,
  NotificationRule,
  Notification,
  ReleaseBundle,
  RuntimeIncident,
} from "@/types/mission-control";

// The tenants table is the one row-set without a foreign tenantId; it scopes to
// itself, so we store tenantId === id to satisfy the Collection contract.
export type TenantRow = Tenant & { tenantId: string };

export interface Database {
  // platform
  tenants: Collection<TenantRow>;
  users: Collection<User>;
  roles: Collection<Role>;
  auditEvents: Collection<AuditEvent>;
  // dataops
  sources: Collection<Source>;
  rawAssets: Collection<RawAsset>;
  pipelineDefinitions: Collection<PipelineDefinition>;
  pipelineRuns: Collection<PipelineRun>;
  canonicalDocuments: Collection<CanonicalDocument>;
  canonicalRecords: Collection<CanonicalRecord>;
  evidenceChunks: Collection<EvidenceChunk>;
  ontologyObjects: Collection<OntologyObject>;
  ontologyLinks: Collection<OntologyLink>;
  lineageEvents: Collection<LineageEvent>;
  // aiops
  aiFunctions: Collection<AiFunction>;
  agentDefinitions: Collection<AgentDefinition>;
  promptTemplates: Collection<PromptTemplate>;
  modelDefinitions: Collection<ModelDefinition>;
  functionRuns: Collection<FunctionRun>;
  agentRuns: Collection<AgentRun>;
  evalCases: Collection<EvalCase>;
  evalRuns: Collection<EvalRun>;
  modelTraces: Collection<ModelTrace>;
  // mission control
  actionDefinitions: Collection<ActionDefinition>;
  actionExecutions: Collection<ActionExecution>;
  reviewCases: Collection<ReviewCase>;
  reviewCaseEvents: Collection<ReviewCaseEvent>;
  notificationRules: Collection<NotificationRule>;
  notifications: Collection<Notification>;
  releaseBundles: Collection<ReleaseBundle>;
  runtimeIncidents: Collection<RuntimeIncident>;
}

function createDatabase(): Database {
  return {
    tenants: new Collection("tenants"),
    users: new Collection("users"),
    roles: new Collection("roles"),
    auditEvents: new Collection("audit_events"),
    sources: new Collection("sources"),
    rawAssets: new Collection("raw_assets"),
    pipelineDefinitions: new Collection("pipeline_definitions"),
    pipelineRuns: new Collection("pipeline_runs"),
    canonicalDocuments: new Collection("canonical_documents"),
    canonicalRecords: new Collection("canonical_records"),
    evidenceChunks: new Collection("evidence_chunks"),
    ontologyObjects: new Collection("ontology_objects"),
    ontologyLinks: new Collection("ontology_links"),
    lineageEvents: new Collection("lineage_events"),
    aiFunctions: new Collection("ai_functions"),
    agentDefinitions: new Collection("agent_definitions"),
    promptTemplates: new Collection("prompt_templates"),
    modelDefinitions: new Collection("model_definitions"),
    functionRuns: new Collection("function_runs"),
    agentRuns: new Collection("agent_runs"),
    evalCases: new Collection("eval_cases"),
    evalRuns: new Collection("eval_runs"),
    modelTraces: new Collection("model_traces"),
    actionDefinitions: new Collection("action_definitions"),
    actionExecutions: new Collection("action_executions"),
    reviewCases: new Collection("review_cases"),
    reviewCaseEvents: new Collection("review_case_events"),
    notificationRules: new Collection("notification_rules"),
    notifications: new Collection("notifications"),
    releaseBundles: new Collection("deployment_releases"),
    runtimeIncidents: new Collection("runtime_incidents"),
  };
}

// In a real deployment this is a connection pool; here a process singleton.
const globalRef = globalThis as unknown as { __lawrenceDb?: Database };
export const db: Database = globalRef.__lawrenceDb ?? (globalRef.__lawrenceDb = createDatabase());

/** Drop all data — used by tests and the seed script. */
export function resetDatabase(): void {
  const fresh = createDatabase();
  for (const key of Object.keys(fresh) as (keyof Database)[]) {
    (db[key] as { clear(): void }).clear();
  }
}
