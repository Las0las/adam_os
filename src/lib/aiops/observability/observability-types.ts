// Phase 7 — observability domain model (§43 productionized). Runtime traces and
// AI usage events make every function/agent/action/pipeline/notification/release
// run measurable: cost, latency, failures, and quality. All rows are
// tenant-scoped (id/tenantId) for the Collection contract.

import type { LearningSignal } from "../learning/learning-types";

export type TraceType =
  | "pipeline_run"
  | "function_run"
  | "agent_run"
  | "action_execution"
  | "retrieval"
  | "notification"
  | "release"
  | "integration";

export type TraceStatus = "running" | "completed" | "failed" | "blocked" | "unknown";

export interface RuntimeTrace {
  id: string;
  tenantId: string;
  traceType: TraceType;
  /** The run/entity id this trace describes (function_run id, etc.). */
  traceId: string;
  componentType?: string | null;
  componentKey?: string | null;
  objectType?: string | null;
  objectId?: string | null;
  status: TraceStatus;
  inputSummary: Record<string, unknown>;
  outputSummary: Record<string, unknown>;
  metrics: Record<string, unknown>;
  citations: Array<Record<string, unknown>>;
  errors: string[];
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

export interface AiUsageEvent {
  id: string;
  tenantId: string;
  runType: string;
  runId: string;
  provider?: string | null;
  modelKey?: string | null;
  purpose?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  estimatedCost?: number | null;
  latencyMs?: number | null;
  status: string;
  errorMessage?: string | null;
  createdAt: string;
}

export interface RetrievalQualityRecord {
  id: string;
  tenantId: string;
  runType: string;
  runId: string;
  query: string;
  methods: string[];
  hits: Array<Record<string, unknown>>;
  expectedObjectRefs: Array<{ objectType: string; objectId: string }>;
  metrics: Record<string, unknown>;
  createdAt: string;
}

export interface ObservabilityRollup {
  id: string;
  tenantId: string;
  rollupType: "hourly" | "daily";
  componentType?: string | null;
  componentKey?: string | null;
  windowStart: string;
  windowEnd: string;
  metrics: Record<string, unknown>;
  createdAt: string;
}

export interface CostMetrics {
  estimatedCost: number;
  byModel: Array<{ modelKey: string; cost: number; tokens: number }>;
}

export interface LatencyMetrics {
  averageMs: number;
  p95Ms: number;
}

export interface FailureMetrics {
  total: number;
  failed: number;
  failureRate: number;
}

export interface QualityMetrics {
  retrievalPassRate?: number;
  extractionAccuracy?: number;
  responseGroundedness?: number;
  recommendationAcceptanceRate?: number;
}

export interface ComponentMetrics {
  componentType: string;
  componentKey: string;
  runs: number;
  failures: number;
  averageLatencyMs: number;
  estimatedCost: number;
}

export interface ObservabilityOverview {
  generatedAt: string;
  metrics: {
    totalRuns24h: number;
    failedRuns24h: number;
    averageLatencyMs: number;
    estimatedCost24h: number;
    retrievalPassRate?: number;
    extractionAccuracy?: number;
    responseGroundedness?: number;
    recommendationAcceptanceRate?: number;
  };
  byComponent: ComponentMetrics[];
  recentFailures: RuntimeTrace[];
  costlyRuns: AiUsageEvent[];
  slowRuns: RuntimeTrace[];
  learningSignals: LearningSignal[];
}
