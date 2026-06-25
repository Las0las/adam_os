// Platform permission catalog (§47.2, Phase 2 §57). Mirrors db/seeds/seed_permissions.sql.

export const PLATFORM_PERMISSIONS = [
  "dataops.admin",
  "dataops.pipeline_run",
  "ontology.admin",
  "ontology.write",
  "aiops.function_admin",
  "aiops.function_run",
  "aiops.agent_admin",
  "mission_control.admin",
  "mission_control.action_execute",
  "review.reviewer",
  "deploy.promote",
  "notifications.manage",
] as const;

export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];
