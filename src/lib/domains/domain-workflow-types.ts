// Phase 4 — shared workflow result + dashboard contracts and the schema-
// validation helper (Part A). AI function outputs are validated against a zod
// schema before any write-back — fail closed on invalid output.

import { z } from "zod";

/** Validate a value against a zod schema; throw (fail closed) on mismatch. */
export function validateOutput<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(`${label}: output failed schema validation — ${result.error.message}`);
  }
  return result.data;
}

/** A single piece of cross-domain work surfaced in the Command Center. */
export interface CommandCenterItem {
  domain: string;
  kind: "action" | "review" | "risk" | "recommendation" | "notification" | "incident";
  title: string;
  severity?: "low" | "medium" | "high" | "critical" | null;
  status?: string | null;
  linkedObjectType?: string | null;
  linkedObjectId?: string | null;
  nextAction?: string | null;
  createdAt: string;
}

/** Generic typed dashboard payload returned by every domain dashboard service. */
export interface DomainDashboard {
  domain: string;
  counts: Record<string, number>;
  cards: DomainDashboardCard[];
}

export interface DomainDashboardCard {
  key: string;
  label: string;
  count: number;
  items: Array<{
    objectId?: string;
    title: string;
    severity?: string | null;
    status?: string | null;
    nextAction?: string | null;
  }>;
}

/** Outcome of running a domain workflow end-to-end. */
export interface DomainWorkflowResult {
  domain: string;
  functionRunId?: string;
  agentRunId?: string;
  output?: Record<string, unknown>;
  reviewCaseIds: string[];
  notificationIds: string[];
  actionExecutionIds: string[];
}
