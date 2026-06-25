// Phase 4 — ONBOARDING live workflow pack: seed pack.
// Imports the functions + actions for their side-effect registration, declares
// the DomainSeedPack (sample case + tasks, function/agent/action metadata, and
// notification rules), and self-registers it with the domain seed runner.

import { registerDomainSeedPack } from "@/lib/domains/domain-seed-runner";
import { onboardingBlockerAgentV2 } from "./onboarding-agent-graphs";
import type { DomainSeedPack } from "@/lib/domains/domain-seed-types";
import type { AgentDefinition } from "@/types/aiops";

// Side-effect imports: register the readiness function + the two actions.
import "./onboarding-functions";
import "./onboarding-actions";

const READINESS_OUTPUT_SCHEMA: Record<string, unknown> = {
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

// A dueAt that sits firmly in the real past, so it is always "overdue" relative
// to the monotonic platform clock.
const PAST_DUE = "2020-01-01T00:00:00.000Z";
// A near-future start date so the case shows up as "starting this week" only
// when the platform clock is near epoch; the exact value is illustrative.
const START_DATE = "2020-01-04T00:00:00.000Z";

export const onboardingSeedPack: DomainSeedPack = {
  key: "onboarding",
  name: "Onboarding",
  description:
    "New-hire onboarding: readiness assessment, blocker escalation, and Day-1 readiness tracking.",
  objectTypes: ["OnboardingCase", "OnboardingTask"],
  functions: [
    {
      key: "onboarding.readiness_summary",
      name: "Onboarding readiness summary",
      description:
        "Assess Day-1 readiness for an onboarding case and deterministically detect blockers.",
      inputSchema: {
        type: "object",
        properties: { onboardingCaseId: { type: "string" } },
        required: ["onboardingCaseId"],
      },
      outputSchema: READINESS_OUTPUT_SCHEMA,
      handlerKey: "onboarding.readiness_summary",
    },
  ],
  agents: [
    {
      key: "onboarding.blocker_escalation",
      name: "Onboarding blocker escalation",
      description:
        "Assess readiness, notify owners on blockers, and open a review for critical blockers.",
      graph: onboardingBlockerAgentV2("__template__").graph as unknown as Record<
        string,
        unknown
      >,
    },
  ],
  actions: [
    {
      key: "onboarding.create_task",
      name: "Create onboarding task",
      objectType: "OnboardingTask",
      handlerKey: "onboarding.create_task",
      inputSchema: {
        type: "object",
        properties: {
          onboardingCaseId: { type: "string" },
          title: { type: "string" },
          ownerUserId: { type: "string" },
          dueAt: { type: "string" },
        },
        required: ["title"],
      },
    },
    {
      key: "onboarding.notify_owner",
      name: "Notify onboarding owner",
      objectType: "OnboardingCase",
      handlerKey: "onboarding.notify_owner",
      inputSchema: {
        type: "object",
        properties: {
          ownerUserId: { type: "string" },
          message: { type: "string" },
          severity: { type: "string" },
        },
        required: ["ownerUserId"],
      },
    },
  ],
  notificationRules: [
    {
      key: "onboarding.blocker.detected",
      name: "Onboarding blocker detected",
      eventType: "onboarding.blocker.detected",
      channel: "in_app",
      templateKey: "onboarding.blocker.detected",
      template: "Onboarding blocker [{{severity}}]: {{message}}",
      config: {},
    },
    {
      key: "onboarding.task.assigned",
      name: "Onboarding task assigned",
      eventType: "onboarding.task.assigned",
      channel: "in_app",
      templateKey: "onboarding.task.assigned",
      template: "You have been assigned onboarding task: {{title}}",
      config: {},
    },
    {
      key: "onboarding.case.critical",
      name: "Onboarding case critical",
      eventType: "onboarding.case.critical",
      channel: "in_app",
      templateKey: "onboarding.case.critical",
      template: "Critical onboarding case: {{message}}",
      config: {},
    },
  ],
  sampleObjects: [
    {
      objectType: "OnboardingCase",
      externalKey: "case-hali",
      title: "Hali Epic Willow Ambulatory",
      status: "in_progress",
      properties: {
        startDate: START_DATE,
        missingDocs: ["signed_offer"],
      },
      evidence: [
        "Offer accepted; start date in 3 days",
        "Background check pending",
        "Equipment not yet shipped",
      ],
    },
    {
      objectType: "OnboardingTask",
      externalKey: "task-offer",
      title: "Send signed offer letter",
      status: "open",
      properties: {
        caseId: "case-hali",
        ownerUserId: "usr_recruiter",
        status: "open",
      },
    },
    {
      objectType: "OnboardingTask",
      externalKey: "task-gusto",
      title: "Set up payroll in Gusto",
      status: "open",
      properties: {
        caseId: "case-hali",
        ownerUserId: "usr_hr",
        status: "open",
      },
    },
    {
      objectType: "OnboardingTask",
      externalKey: "task-bg",
      title: "Complete background check",
      status: "open",
      properties: {
        // No ownerUserId -> "missing owner" blocker.
        caseId: "case-hali",
        status: "open",
      },
    },
    {
      objectType: "OnboardingTask",
      externalKey: "task-equip",
      title: "Ship equipment",
      status: "open",
      properties: {
        // Overdue -> high-severity blocker.
        caseId: "case-hali",
        ownerUserId: "usr_it",
        status: "open",
        dueAt: PAST_DUE,
      },
    },
    {
      objectType: "OnboardingTask",
      externalKey: "task-creds",
      title: "Provision Epic credentials",
      status: "done",
      properties: {
        caseId: "case-hali",
        ownerUserId: "usr_it",
        status: "done",
      },
    },
    {
      objectType: "OnboardingTask",
      externalKey: "task-kickoff",
      title: "Schedule Day-1 kickoff",
      status: "open",
      properties: {
        caseId: "case-hali",
        ownerUserId: "usr_manager",
        status: "open",
      },
    },
  ],
};

registerDomainSeedPack(onboardingSeedPack);

/** Agent factory for the onboarding blocker-escalation agent. */
export function onboardingAgentFactory(tenantId: string): AgentDefinition {
  return onboardingBlockerAgentV2(tenantId);
}

export { onboardingBlockerAgentV2 };
