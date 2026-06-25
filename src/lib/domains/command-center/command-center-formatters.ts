// Phase 5 — presentation formatters (Part A). Pure, testable helpers that turn
// raw fields into human labels for the operating surface.

import type { CommandDomain, CommandItemStatus, CommandSeverity } from "./command-center-types";

const DOMAIN_LABELS: Record<CommandDomain, string> = {
  recruiting: "Recruiting",
  onboarding: "Onboarding",
  support: "Support",
  claims: "Claims",
  executive: "Executive",
  mission_control: "Mission Control",
};

const STATUS_LABELS: Record<CommandItemStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  awaiting_review: "Awaiting review",
  awaiting_approval: "Awaiting approval",
  blocked: "Blocked",
  completed: "Completed",
  failed: "Failed",
};

export function domainLabel(domain: CommandDomain): string {
  return DOMAIN_LABELS[domain] ?? domain;
}

export function statusLabel(status: CommandItemStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function severityLabel(severity?: CommandSeverity | null): string {
  return severity ? severity[0]!.toUpperCase() + severity.slice(1) : "—";
}

/** Compact relative age, e.g. "5m", "3h", "2d". referenceTime defaults to now. */
export function formatRelativeAge(createdAt: string, referenceTime?: string): string {
  const ref = referenceTime ? Date.parse(referenceTime) : Date.now();
  const then = Date.parse(createdAt);
  if (!Number.isFinite(ref) || !Number.isFinite(then)) return "—";
  const mins = Math.max(0, Math.floor((ref - then) / 60_000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** Whether a due date is overdue relative to the reference time. */
export function isOverdue(dueAt?: string | null, referenceTime?: string): boolean {
  if (!dueAt) return false;
  const ref = referenceTime ? Date.parse(referenceTime) : Date.now();
  const due = Date.parse(dueAt);
  return Number.isFinite(due) && Number.isFinite(ref) && due < ref;
}
