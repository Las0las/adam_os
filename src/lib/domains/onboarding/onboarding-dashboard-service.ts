// Phase 4 — ONBOARDING live workflow pack: dashboard service.
// Aggregates onboarding ontology objects into a typed DomainDashboard:
// counts + cards for starts-this-week, blocked cases, missing owners, overdue
// tasks, and Day-1 readiness.

import { now } from "@/lib/lawrence-core/utils/ids";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import type { ActorContext } from "@/types/platform";
import type {
  DomainDashboard,
  DomainDashboardCard,
} from "@/lib/domains/domain-workflow-types";

function str(value: unknown): string | undefined {
  return value == null ? undefined : String(value);
}

/** Within ~7 days forward of the platform clock (lexicographic ISO compare). */
function isStartingThisWeek(startDate: string | undefined, ref: string): boolean {
  if (!startDate) return false;
  const refMs = Date.parse(ref);
  const startMs = Date.parse(startDate);
  if (Number.isNaN(refMs) || Number.isNaN(startMs)) return false;
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  return startMs >= refMs && startMs <= refMs + weekMs;
}

function isOverdue(dueAt: string | undefined, ref: string): boolean {
  if (!dueAt) return false;
  return dueAt < ref;
}

export async function getOnboardingDashboard(
  ctx: ActorContext,
): Promise<DomainDashboard> {
  const cases = await listObjects(ctx, "OnboardingCase");
  const tasks = await listObjects(ctx, "OnboardingTask");
  const ref = now();

  const openTasks = tasks.filter(
    (t) => (str(t.properties.status) ?? t.status) !== "done",
  );
  const missingOwnerTasks = tasks.filter((t) => !str(t.properties.ownerUserId));
  const overdueTasks = tasks.filter(
    (t) =>
      (str(t.properties.status) ?? t.status) !== "done" &&
      isOverdue(str(t.properties.dueAt), ref),
  );

  // Map a task's caseId (internal id OR external key) to the case's internal id.
  const caseIdByKey = new Map<string, string>();
  for (const c of cases) {
    caseIdByKey.set(c.id, c.id);
    if (c.externalKey) caseIdByKey.set(c.externalKey, c.id);
  }

  // A case is "blocked" if it has missing docs or any overdue/un-owned task.
  const blockedCaseIds = new Set<string>();
  for (const c of cases) {
    const missingDocs = c.properties.missingDocs;
    if (Array.isArray(missingDocs) && missingDocs.length > 0) {
      blockedCaseIds.add(c.id);
    }
  }
  for (const t of [...overdueTasks, ...missingOwnerTasks]) {
    const caseId = str(t.properties.caseId);
    const internalId = caseId ? caseIdByKey.get(caseId) : undefined;
    if (internalId) blockedCaseIds.add(internalId);
  }

  const startsThisWeek = cases.filter((c) =>
    isStartingThisWeek(str(c.properties.startDate), ref),
  );

  const counts: Record<string, number> = {
    cases: cases.length,
    tasks: tasks.length,
    openTasks: openTasks.length,
    blockedCases: blockedCaseIds.size,
  };

  const cards: DomainDashboardCard[] = [
    {
      key: "starts_this_week",
      label: "Starts This Week",
      count: startsThisWeek.length,
      items: startsThisWeek.map((c) => ({
        objectId: c.id,
        title: c.title ?? c.externalKey ?? c.id,
        status: c.status,
        nextAction: "Confirm Day-1 readiness",
      })),
    },
    {
      key: "blocked_cases",
      label: "Blocked Cases",
      count: blockedCaseIds.size,
      items: cases
        .filter((c) => blockedCaseIds.has(c.id))
        .map((c) => ({
          objectId: c.id,
          title: c.title ?? c.externalKey ?? c.id,
          status: c.status,
          nextAction: "Escalate blockers to owners",
        })),
    },
    {
      key: "missing_owners",
      label: "Missing Owners",
      count: missingOwnerTasks.length,
      items: missingOwnerTasks.map((t) => ({
        objectId: t.id,
        title: t.title ?? t.externalKey ?? t.id,
        status: str(t.properties.status) ?? t.status,
        nextAction: "Assign an owner",
      })),
    },
    {
      key: "overdue_tasks",
      label: "Overdue Tasks",
      count: overdueTasks.length,
      items: overdueTasks.map((t) => ({
        objectId: t.id,
        title: t.title ?? t.externalKey ?? t.id,
        status: str(t.properties.status) ?? t.status,
        nextAction: "Complete overdue task",
      })),
    },
    {
      key: "day1_readiness",
      label: "Day-1 Readiness",
      count: cases.length - blockedCaseIds.size,
      items: cases
        .filter((c) => !blockedCaseIds.has(c.id))
        .map((c) => ({
          objectId: c.id,
          title: c.title ?? c.externalKey ?? c.id,
          status: c.status,
          nextAction: "Ready for Day 1",
        })),
    },
  ];

  return { domain: "onboarding", counts, cards };
}
