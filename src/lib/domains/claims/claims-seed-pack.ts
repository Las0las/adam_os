// Phase 4 CLAIMS — domain seed pack. Declares ontology types, the evidence-
// summary function, the validation agent, the create-finding action, the two
// notification rules, and a sample validation case with contradictory evidence.
// Side-effect imports register the function + action handlers;
// registerDomainSeedPack registers the pack for install.

import "./claims-functions";
import "./claims-actions";

import { registerDomainSeedPack } from "@/lib/domains/domain-seed-runner";
import { claimValidationAgentV2 } from "./claims-agent-graphs";
import type { DomainSeedPack } from "@/lib/domains/domain-seed-types";

export const claimsSeedPack: DomainSeedPack = {
  key: "claims",
  name: "Claims / Validation",
  description:
    "Live claims-validation workflow: evidence-grounded reasoning, deterministic findings, and human-review routing.",
  objectTypes: ["ValidationCase", "ClaimDocument", "EmailMessage", "ValidationFinding"],
  functions: [
    {
      key: "claims.validation_case_evidence_summary",
      name: "Validation case evidence summary",
      description: "Grounded evidence reasoning that derives deterministic validation findings.",
      inputSchema: {
        type: "object",
        properties: { validationCaseId: { type: "string" } },
        required: ["validationCaseId"],
      },
      outputSchema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          confidence: { type: "number" },
          findings: { type: "array", items: { type: "object" } },
          recommendedDisposition: { type: "string" },
        },
      },
      handlerKey: "claims.validation_case_evidence_summary",
    },
  ],
  agents: [
    {
      key: "claims.validation_agent",
      name: "Claim validation agent (v2)",
      description: "Retrieve claim evidence, reason over it, and route high-severity findings.",
      graph: claimValidationAgentV2("__seed__").graph as unknown as Record<string, unknown>,
    },
  ],
  actions: [
    {
      key: "claims.create_validation_finding",
      name: "Create validation finding",
      objectType: "ValidationFinding",
      handlerKey: "claims.create_validation_finding",
      inputSchema: {
        type: "object",
        properties: {
          validationCaseId: { type: "string" },
          severity: { type: "string" },
          findingType: { type: "string" },
          message: { type: "string" },
          evidenceRefs: { type: "array" },
        },
        required: ["validationCaseId", "findingType"],
      },
    },
  ],
  notificationRules: [
    {
      key: "claims.finding.critical",
      name: "Claims finding critical",
      eventType: "claims.finding.critical",
      channel: "in_app",
      templateKey: "claims.finding.critical",
      config: {},
    },
    {
      key: "claims.case.needs_review",
      name: "Claims case needs review",
      eventType: "claims.case.needs_review",
      channel: "in_app",
      templateKey: "claims.case.needs_review",
      config: {},
    },
  ],
  sampleObjects: [
    {
      objectType: "ValidationCase",
      externalKey: "clm-001",
      title: "CLM-001 Claim Validation",
      status: "open",
      properties: {
        caseType: "claim_validation",
        subjectObjectType: "ClaimDocument",
        subjectObjectId: "claimdoc-1",
      },
      evidence: [
        "Claim amount stated as 5000 on the form",
        "Attached invoice shows 4200",
        "Policy reference PRX-22; no signature found",
      ],
    },
    {
      objectType: "EmailMessage",
      externalKey: "eml-1",
      title: "Email: Claim CLM-001",
      properties: { from: "claimant@x.com", subject: "Claim CLM-001" },
    },
    {
      objectType: "ClaimDocument",
      externalKey: "claimdoc-1",
      title: "Claim document claimdoc-1",
      properties: { amount: 5000 },
    },
  ],
};

registerDomainSeedPack(claimsSeedPack);

export { claimValidationAgentV2 };
