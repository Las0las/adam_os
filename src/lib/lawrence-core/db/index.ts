// The LAWRENCE operational database: one tenant-scoped Collection per table
// from the §46 schema outline. The backend is selected at startup — Postgres
// (PgCollection) when DATABASE_URL is set, otherwise the in-memory MemoryCollection.

import { MemoryCollection } from "./collection";
import { PgCollection } from "./pg/pg-collection";
import type { Collection, TenantScoped } from "./collection";
import { isPostgresConfigured } from "./pg/client";

/** Construct a collection backed by the configured store. */
function coll<T extends TenantScoped>(name: string): Collection<T> {
  return isPostgresConfigured() ? new PgCollection<T>(name) : new MemoryCollection<T>(name);
}
import type { Role, Tenant, User, AuditEvent } from "@/types/platform";
import type {
  Source,
  RawAsset,
  IngestionBatch,
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
import type {
  Environment,
  ReleaseBundle as HardenedReleaseBundle,
  ReleaseBundleItem,
  ApprovalRequest,
  RuntimeComponent,
  KillSwitch,
  RuntimeHealthCheck,
  RollbackRecord,
} from "@/lib/mission-control/runtime/mission-control-hardening-types";
import type { ApprovalPolicy } from "@/lib/mission-control/approvals/approval-policy-types";
import type {
  RuntimeTrace,
  AiUsageEvent,
  RetrievalQualityRecord,
  ObservabilityRollup,
} from "@/lib/aiops/observability/observability-types";
import type {
  EvalSuite,
  EvalCaseResultRecord,
} from "@/lib/aiops/evals/eval-production-types";
import type {
  HumanFeedback,
  RecommendationOutcome,
  LearningSignal,
} from "@/lib/aiops/learning/learning-types";
import type {
  DomainPackInstallation,
  DomainPackDemoRun,
} from "@/lib/domain-packs/domain-pack-types";

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
  ingestionBatches: Collection<IngestionBatch>;
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
  // mission control — Phase 6 hardening (governance / deployment control plane)
  environments: Collection<Environment>;
  hardenedReleases: Collection<HardenedReleaseBundle>;
  releaseBundleItems: Collection<ReleaseBundleItem>;
  approvalRequests: Collection<ApprovalRequest>;
  approvalPolicies: Collection<ApprovalPolicy>;
  runtimeComponents: Collection<RuntimeComponent>;
  killSwitches: Collection<KillSwitch>;
  runtimeHealthChecks: Collection<RuntimeHealthCheck>;
  rollbackRecords: Collection<RollbackRecord>;
  // aiops — Phase 7 observability / evals / learning
  runtimeTraces: Collection<RuntimeTrace>;
  aiUsageEvents: Collection<AiUsageEvent>;
  retrievalQualityRecords: Collection<RetrievalQualityRecord>;
  observabilityRollups: Collection<ObservabilityRollup>;
  evalSuites: Collection<EvalSuite>;
  evalCaseResults: Collection<EvalCaseResultRecord>;
  humanFeedback: Collection<HumanFeedback>;
  recommendationOutcomes: Collection<RecommendationOutcome>;
  learningSignals: Collection<LearningSignal>;
  // domain packs — Phase 8
  domainPackInstallations: Collection<DomainPackInstallation>;
  domainPackDemoRuns: Collection<DomainPackDemoRun>;
}

function createDatabase(): Database {
  return {
    tenants: coll("tenants"),
    users: coll("users"),
    roles: coll("roles"),
    auditEvents: coll("audit_events"),
    sources: coll("sources"),
    rawAssets: coll("raw_assets"),
    ingestionBatches: coll("ingestion_batches"),
    pipelineDefinitions: coll("pipeline_definitions"),
    pipelineRuns: coll("pipeline_runs"),
    canonicalDocuments: coll("canonical_documents"),
    canonicalRecords: coll("canonical_records"),
    evidenceChunks: coll("evidence_chunks"),
    ontologyObjects: coll("ontology_objects"),
    ontologyLinks: coll("ontology_links"),
    lineageEvents: coll("lineage_events"),
    aiFunctions: coll("ai_functions"),
    agentDefinitions: coll("agent_definitions"),
    promptTemplates: coll("prompt_templates"),
    modelDefinitions: coll("model_definitions"),
    functionRuns: coll("function_runs"),
    agentRuns: coll("agent_runs"),
    evalCases: coll("eval_cases"),
    evalRuns: coll("eval_runs"),
    modelTraces: coll("model_traces"),
    actionDefinitions: coll("action_definitions"),
    actionExecutions: coll("action_executions"),
    reviewCases: coll("review_cases"),
    reviewCaseEvents: coll("review_case_events"),
    notificationRules: coll("notification_rules"),
    notifications: coll("notifications"),
    releaseBundles: coll("deployment_releases"),
    runtimeIncidents: coll("runtime_incidents"),
    environments: coll("environments"),
    hardenedReleases: coll("release_bundles"),
    releaseBundleItems: coll("release_bundle_items"),
    approvalRequests: coll("approval_requests"),
    approvalPolicies: coll("approval_policies"),
    runtimeComponents: coll("runtime_components"),
    killSwitches: coll("kill_switches"),
    runtimeHealthChecks: coll("runtime_health_checks"),
    rollbackRecords: coll("rollback_records"),
    runtimeTraces: coll("runtime_traces"),
    aiUsageEvents: coll("ai_usage_events"),
    retrievalQualityRecords: coll("retrieval_quality_records"),
    observabilityRollups: coll("observability_rollups"),
    evalSuites: coll("eval_suites"),
    evalCaseResults: coll("eval_case_results"),
    humanFeedback: coll("human_feedback"),
    recommendationOutcomes: coll("recommendation_outcomes"),
    learningSignals: coll("learning_signals"),
    domainPackInstallations: coll("domain_pack_installations"),
    domainPackDemoRuns: coll("domain_pack_demo_runs"),
  };
}

// In a real deployment this is a connection pool; here a process singleton.
const globalRef = globalThis as unknown as { __lawrenceDb?: Database };
export const db: Database = globalRef.__lawrenceDb ?? (globalRef.__lawrenceDb = createDatabase());

/** Drop all data — used by tests and the seed script. */
export async function resetDatabase(): Promise<void> {
  for (const key of Object.keys(db) as (keyof Database)[]) {
    await db[key].clear();
  }
}
