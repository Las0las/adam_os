// Phase 4 — ONBOARDING live workflow pack: functions.
// Registers the deterministic "onboarding.readiness_summary" reasoning function.
// It loads an OnboardingCase + its OnboardingTasks, computes blockers
// deterministically (overdue tasks, missing owners, missing docs, no tasks),
// derives a readiness score, and asks the model provider only for prose. The
// structured output is zod-validated (fail closed) before being returned.

import { z } from "zod";
import { now } from "@/lib/lawrence-core/utils/ids";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { retrieve } from "@/lib/aiops/retrieval/retrieval-service";
import { getModelProvider } from "@/lib/aiops/models/model-provider";
import { runModelCompletion } from "@/lib/aiops/execution/inference-pipeline";
import { registerFunction } from "@/lib/aiops/functions/function-registry";
import { validateOutput } from "@/lib/domains/domain-workflow-types";
import type {
  LawrenceFunction,
  FunctionExecutionResult,
} from "@/lib/aiops/functions/function-types";
import type { RetrievalHit } from "@/types/dataops";

type Severity = "low" | "medium" | "high" | "critical";

export interface ReadinessBlocker {
  taskId?: string;
  ownerUserId?: string;
  severity: Severity;
  reason: string;
}

export interface OwnerAction {
  ownerUserId?: string;
  action: string;
  dueAt?: string;
}

export interface ReadinessSummaryOutput {
  ready: boolean;
  readinessScore: number;
  summary: string;
  blockers: ReadinessBlocker[];
  nextOwnerActions: OwnerAction[];
}

const blockerSchema: z.ZodType<ReadinessBlocker> = z.object({
  taskId: z.string().optional(),
  ownerUserId: z.string().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  reason: z.string(),
});

const ownerActionSchema: z.ZodType<OwnerAction> = z.object({
  ownerUserId: z.string().optional(),
  action: z.string(),
  dueAt: z.string().optional(),
});

const readinessOutputSchema: z.ZodType<ReadinessSummaryOutput> = z.object({
  ready: z.boolean(),
  readinessScore: z.number(),
  summary: z.string(),
  blockers: z.array(blockerSchema),
  nextOwnerActions: z.array(ownerActionSchema),
});

const outputJsonSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    ready: { type: "boolean" },
    readinessScore: { type: "number" },
    summary: { type: "string" },
    blockers: { type: "array" },
    nextOwnerActions: { type: "array" },
  },
  required: ["ready", "readinessScore", "summary", "blockers", "nextOwnerActions"],
};

function str(value: unknown): string | undefined {
  return value == null ? undefined : String(value);
}

/** Lexicographic ISO timestamp comparison: is `value` strictly before `ref`? */
function isOverdue(value: unknown, ref: string): boolean {
  const v = str(value);
  if (!v) return false;
  return v < ref;
}

export const onboardingReadinessSummary: LawrenceFunction<
  { onboardingCaseId?: unknown },
  ReadinessSummaryOutput
> = {
  key: "onboarding.readiness_summary",
  name: "Onboarding readiness summary",
  description:
    "Assess a new-hire onboarding case for Day-1 readiness: deterministically detect blockers (overdue tasks, missing owners, missing docs) and summarize next owner actions.",
  klass: "reason",
  outputSchema: outputJsonSchema,
  async run(
    ctx,
    input,
  ): Promise<FunctionExecutionResult<ReadinessSummaryOutput>> {
    const onboardingCaseId = str(input.onboardingCaseId);
    if (!onboardingCaseId) {
      // Fail closed: no case id supplied.
      throw new Error("onboarding.readiness_summary: missing onboardingCaseId");
    }

    const cases = await listObjects(ctx, "OnboardingCase");
    const onboardingCase = cases.find((c) => c.id === onboardingCaseId);
    if (!onboardingCase) {
      // Fail closed: the referenced case does not exist.
      throw new Error(
        `onboarding.readiness_summary: OnboardingCase not found: ${onboardingCaseId}`,
      );
    }

    // Tasks reference their case via properties.caseId, which may carry either
    // the case's internal object id or its external key — match either.
    const caseKeys = new Set<string>([onboardingCase.id]);
    if (onboardingCase.externalKey) caseKeys.add(onboardingCase.externalKey);
    const allTasks = await listObjects(ctx, "OnboardingTask");
    const tasks = allTasks.filter((t) => {
      const caseId = str(t.properties.caseId);
      return caseId !== undefined && caseKeys.has(caseId);
    });

    const ref = onboardingNow();
    const blockers: ReadinessBlocker[] = [];
    const nextOwnerActions: OwnerAction[] = [];

    // Deterministic blocker detection.
    if (tasks.length === 0) {
      blockers.push({ severity: "medium", reason: "no tasks defined" });
    }

    for (const task of tasks) {
      const status = str(task.properties.status) ?? task.status ?? "open";
      const ownerUserId = str(task.properties.ownerUserId);
      const dueAt = str(task.properties.dueAt);
      const title = task.title ?? task.externalKey ?? task.id;

      const done = status === "done";

      if (!done && isOverdue(dueAt, ref)) {
        blockers.push({
          taskId: task.id,
          ownerUserId,
          severity: "high",
          reason: `Task "${title}" is overdue (due ${dueAt}) and not done`,
        });
        nextOwnerActions.push({
          ownerUserId,
          action: `Complete overdue task "${title}"`,
          dueAt,
        });
      }

      if (!ownerUserId) {
        blockers.push({
          taskId: task.id,
          severity: "medium",
          reason: `missing owner for task "${title}"`,
        });
        nextOwnerActions.push({
          action: `Assign an owner to task "${title}"`,
          dueAt,
        });
      }
    }

    const missingDocsRaw = onboardingCase.properties.missingDocs;
    const missingDocs = Array.isArray(missingDocsRaw)
      ? missingDocsRaw.map((d) => String(d))
      : [];
    for (const doc of missingDocs) {
      blockers.push({
        severity: "high",
        reason: `missing document: ${doc}`,
      });
      nextOwnerActions.push({ action: `Collect missing document: ${doc}` });
    }

    const totalTasks = tasks.length;
    const doneTasks = tasks.filter(
      (t) => (str(t.properties.status) ?? t.status) === "done",
    ).length;
    const readinessScore = totalTasks > 0 ? doneTasks / totalTasks : 0;
    const ready = blockers.length === 0;

    // Pull any indexed evidence for this case to ground the prose + citations.
    const retrieval = await retrieve(ctx, {
      tenantId: ctx.tenantId,
      query: `onboarding readiness blockers ${onboardingCase.title ?? onboardingCaseId}`,
      objectTypes: ["OnboardingCase"],
      subjectObjectId: onboardingCase.id,
      methods: ["rank_fusion"],
      limit: 5,
    });
    const citations: RetrievalHit[] = retrieval.hits;

    const evidenceText = citations.map((h) => h.excerpt).join(" ").slice(0, 600);
    const blockerLines = blockers
      .map((b) => `- [${b.severity}] ${b.reason}`)
      .join("\n");
    const provider = getModelProvider();
    const completion = await runModelCompletion({
      provider,
      request: {
        prompt: [
          `Onboarding case: ${onboardingCase.title ?? onboardingCaseId}`,
          `Status: ${onboardingCase.status ?? "unknown"}`,
          `Tasks: ${doneTasks}/${totalTasks} done. Readiness score: ${readinessScore.toFixed(2)}.`,
          `Ready for Day 1: ${ready ? "yes" : "no"}.`,
          blockers.length
            ? `Detected blockers:\n${blockerLines}`
            : "No blockers detected.",
          evidenceText ? `Evidence: ${evidenceText}` : "",
          "Write a short readiness summary for the onboarding owner.",
        ]
          .filter(Boolean)
          .join("\n"),
      },
      workloadType: "onboarding.readiness_summary",
    });

    const summary =
      completion.text.trim() ||
      (ready
        ? `Onboarding for ${onboardingCase.title ?? onboardingCaseId} is on track for Day 1.`
        : `Onboarding for ${onboardingCase.title ?? onboardingCaseId} has ${blockers.length} open blocker(s).`);

    const output = validateOutput(
      readinessOutputSchema,
      { ready, readinessScore, summary, blockers, nextOwnerActions },
      "onboarding.readiness_summary",
    );

    return citations.length ? { output, citations } : { output };
  },
};

registerFunction(onboardingReadinessSummary);

// "Current time" reference for overdue comparisons. The platform clock is
// monotonic ISO (utils/ids `now`); seeded dueAt values that sit in the real
// past are therefore always strictly less than this reference.
function onboardingNow(): string {
  return now();
}
