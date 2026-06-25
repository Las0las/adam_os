// Phase 5 — pure domain inference (no db imports), safe for client components.
// The Command Center service re-exports these for server-side use.

import type { CommandDomain } from "./command-center-types";

export const DOMAIN_BY_OBJECT_TYPE: Record<string, CommandDomain> = {
  Candidate: "recruiting",
  Job: "recruiting",
  Submission: "recruiting",
  RecruiterNote: "recruiting",
  OnboardingCase: "onboarding",
  OnboardingTask: "onboarding",
  SupportTicket: "support",
  KnowledgeDocument: "support",
  SupportDraftResponse: "support",
  ValidationCase: "claims",
  ValidationFinding: "claims",
  ClaimDocument: "claims",
  EmailMessage: "claims",
  Account: "executive",
  Opportunity: "executive",
  RiskSignal: "executive",
  DecisionMemo: "executive",
};

export function inferDomain(hint?: string | null): CommandDomain {
  if (!hint) return "mission_control";
  if (DOMAIN_BY_OBJECT_TYPE[hint]) return DOMAIN_BY_OBJECT_TYPE[hint] as CommandDomain;
  const prefix = hint.split(/[._:]/)[0] ?? "";
  if (["recruiting", "onboarding", "support", "claims", "executive"].includes(prefix)) {
    return prefix as CommandDomain;
  }
  return "mission_control";
}
