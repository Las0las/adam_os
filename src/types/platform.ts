// LAWRENCE platform domain model (tenancy / auth / actor).
// See spec §7.

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  roleIds: string[];
  createdAt: string;
}

export interface Role {
  id: string;
  tenantId: string;
  name: string;
  permissions: Permission[];
}

// §47.2 permission classes.
export type Permission =
  | "dataops.admin"
  | "ontology.admin"
  | "aiops.function_admin"
  | "aiops.agent_admin"
  | "review.reviewer"
  | "mission_control.admin"
  | "deploy.promote"
  | "notifications.manage"
  | "integrations.manage";

/** The authenticated actor context threaded through every service call. */
export interface ActorContext {
  tenantId: string;
  actorUserId?: string | null;
  permissions: Permission[];
}

export interface AuditEvent {
  id: string;
  tenantId: string;
  actorUserId?: string | null;
  action: string;
  subjectType?: string | null;
  subjectId?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}
