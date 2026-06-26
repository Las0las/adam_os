// Phase 9 — default tenant configuration constants used at bootstrap.

import type { Permission } from "@/types/platform";

export const DEFAULT_ADMIN_PERMISSIONS: Permission[] = [
  "dataops.admin",
  "ontology.admin",
  "aiops.function_admin",
  "aiops.agent_admin",
  "review.reviewer",
  "mission_control.admin",
  "deploy.promote",
  "notifications.manage",
  "integrations.manage",
];

export const DEFAULT_ENVIRONMENTS = ["dev", "staging", "prod"] as const;

export const DEFAULT_APPROVAL_POLICY_KEYS = [
  "prod_release_requires_approval",
  "rollback_requires_approval",
  "kill_switch_requires_reason",
  "external_side_effect_requires_approval",
  "destructive_action_requires_approval",
] as const;
