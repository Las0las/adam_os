// Phase 9 — enterprise integration framework contracts. Connections are
// tenant-scoped; credentials are referenced (credentialRef) and never stored or
// returned in plaintext. Adapters fail closed: missing credentials yield
// not_configured/degraded, never fake success.

export type IntegrationProvider =
  | "microsoft365"
  | "google_workspace"
  | "slack"
  | "greenhouse"
  | "lever"
  | "gusto"
  | "sharepoint"
  | "one_drive"
  | "custom_api"
  | "webhook";

export type IntegrationStatus =
  | "not_configured"
  | "active"
  | "degraded"
  | "disabled"
  | "failed";

export type SyncType = "full" | "incremental" | "webhook" | "test";
export type SyncStatus = "queued" | "running" | "completed" | "failed" | "degraded";
export type WebhookEventStatus = "received" | "processed" | "ignored" | "failed";

export interface IntegrationConnection {
  id: string;
  tenantId: string;
  key: string;
  name: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  config: Record<string, unknown>;
  credentialRef?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationSyncRun {
  id: string;
  tenantId: string;
  connectionId: string;
  syncType: SyncType;
  status: SyncStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  recordsRead: number;
  recordsWritten: number;
  assetsCreated: number;
  errorMessage?: string | null;
  metrics: Record<string, unknown>;
  createdAt: string;
}

export interface IntegrationWebhookEvent {
  id: string;
  tenantId: string;
  connectionId?: string | null;
  provider: IntegrationProvider;
  eventType: string;
  externalEventId?: string | null;
  payload: Record<string, unknown>;
  status: WebhookEventStatus;
  processedAt?: string | null;
  errorMessage?: string | null;
  createdAt: string;
}

export interface IntegrationObjectMapping {
  id: string;
  tenantId: string;
  connectionId: string;
  externalObjectType: string;
  externalObjectId: string;
  lawrenceObjectType: string;
  lawrenceObjectId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ── Adapter contract ────────────────────────────────────────────────────────

export interface IntegrationHealthResult {
  status: IntegrationStatus;
  message: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

export interface IntegrationSyncInput {
  syncType: SyncType;
  /** Resolved credential (or null when not configured). Never logged. */
  credential: string | null;
  cursor?: string | null;
}

export interface SyncedObject {
  externalObjectType: string;
  externalObjectId: string;
  lawrenceObjectType: string;
  lawrenceObjectId: string;
}

export interface IntegrationSyncResult {
  status: SyncStatus;
  recordsRead: number;
  recordsWritten: number;
  assetsCreated: number;
  mappings: SyncedObject[];
  message?: string;
  metrics?: Record<string, unknown>;
}

export interface IntegrationWebhookInput {
  connection: IntegrationConnection;
  eventType: string;
  externalEventId?: string | null;
  payload: Record<string, unknown>;
  signature?: string | null;
}

export interface IntegrationWebhookResult {
  status: WebhookEventStatus;
  message?: string;
}

export interface IntegrationAdapter {
  provider: IntegrationProvider;
  /** Capability labels for catalog display. */
  capabilities: string[];
  testConnection(connection: IntegrationConnection, credential: string | null): Promise<IntegrationHealthResult>;
  sync(connection: IntegrationConnection, input: IntegrationSyncInput): Promise<IntegrationSyncResult>;
  handleWebhook?(input: IntegrationWebhookInput): Promise<IntegrationWebhookResult>;
}
