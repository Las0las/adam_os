// Phase 5 — Command Center ranking model (Part A3 + G2). priorityScore blends
// severity, runtime status, age, due date, domain weight, and surface mode so
// the most urgent governed work sorts to the top of every queue.

import { MODE_DOMAIN_BONUS } from "./surface-mode";
import type {
  CommandCenterItem,
  CommandDomain,
  CommandItemStatus,
  CommandSeverity,
  SurfaceMode,
} from "./command-center-types";

const SEVERITY_SCORE: Record<CommandSeverity, number> = {
  critical: 100,
  high: 70,
  medium: 40,
  low: 10,
};

const STATUS_SCORE: Record<CommandItemStatus, number> = {
  failed: 45,
  blocked: 40,
  awaiting_approval: 35,
  awaiting_review: 30,
  open: 20,
  in_progress: 5,
  completed: 0,
};

const DOMAIN_SCORE: Record<CommandDomain, number> = {
  executive: 15,
  claims: 12,
  onboarding: 10,
  recruiting: 8,
  support: 5,
  mission_control: 0,
};

const HOUR_MS = 3_600_000;

export interface RankOptions {
  mode: SurfaceMode;
  /** ISO reference time used for age/due math (deterministic in tests). */
  referenceTime: string;
}

export function computePriorityScore(item: CommandCenterItem, opts: RankOptions): number {
  let score = 0;

  if (item.severity) score += SEVERITY_SCORE[item.severity];
  score += STATUS_SCORE[item.status] ?? 0;
  score += DOMAIN_SCORE[item.domain] ?? 0;
  score += MODE_DOMAIN_BONUS[opts.mode][item.domain] ?? 0;

  const ref = Date.parse(opts.referenceTime);
  const created = Date.parse(item.createdAt);
  if (Number.isFinite(ref) && Number.isFinite(created)) {
    const ageHours = (ref - created) / HOUR_MS;
    if (ageHours > 72) score += 20;
    else if (ageHours > 24) score += 10;
  }

  if (item.dueAt) {
    const due = Date.parse(item.dueAt);
    if (Number.isFinite(due) && Number.isFinite(ref)) {
      if (due < ref) score += 40;
      else if (due - ref <= 24 * HOUR_MS) score += 20;
    }
  }

  return score;
}

/** Apply priorityScore to each item and return a new array sorted desc. */
export function rankItems(items: CommandCenterItem[], opts: RankOptions): CommandCenterItem[] {
  return items
    .map((item) => ({ ...item, priorityScore: computePriorityScore(item, opts) }))
    .sort((a, b) => b.priorityScore - a.priorityScore || b.createdAt.localeCompare(a.createdAt));
}
