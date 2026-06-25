// Phase 5 — Domain panel registry (Part F). Maps an object type to its
// domain-flavored Overview panel, or null when only the generic properties view
// applies.

import type { ComponentType } from "react";
import type { ObjectDetail } from "@/lib/domains/object-detail/object-detail-types";
import { CandidateDetailPanel } from "./CandidateDetailPanel";
import { JobDetailPanel } from "./JobDetailPanel";
import { OnboardingCaseDetailPanel } from "./OnboardingCaseDetailPanel";
import { SupportTicketDetailPanel } from "./SupportTicketDetailPanel";
import { ValidationCaseDetailPanel } from "./ValidationCaseDetailPanel";
import { AccountDetailPanel } from "./AccountDetailPanel";
import { RiskSignalDetailPanel } from "./RiskSignalDetailPanel";

export type DomainPanel = ComponentType<{ detail: ObjectDetail }>;

const REGISTRY: Record<string, DomainPanel> = {
  Candidate: CandidateDetailPanel,
  Job: JobDetailPanel,
  OnboardingCase: OnboardingCaseDetailPanel,
  SupportTicket: SupportTicketDetailPanel,
  ValidationCase: ValidationCaseDetailPanel,
  Account: AccountDetailPanel,
  RiskSignal: RiskSignalDetailPanel,
};

/** Return the domain Overview panel for an object type, or null. */
export function domainPanelFor(objectType: string): DomainPanel | null {
  return REGISTRY[objectType] ?? null;
}
