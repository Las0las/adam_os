// Phase 4 RECRUITING — domain seed pack. Declares ontology types, the fit
// function, the shortlist-builder agent, both actions, notification rules, and
// sample jobs/candidates/submissions. Side-effect imports register the function
// and action handlers; registerDomainSeedPack registers the pack for install.

import "./recruiting-functions";
import "./recruiting-actions";

import { registerDomainSeedPack } from "@/lib/domains/domain-seed-runner";
import { shortlistBuilderAgentV2 } from "./recruiting-agent-graphs";
import type { DomainSeedPack } from "@/lib/domains/domain-seed-types";

export const recruitingSeedPack: DomainSeedPack = {
  key: "recruiting",
  name: "Recruiting",
  description: "Live recruiting workflow: candidate-fit reasoning, shortlisting, and review routing.",
  objectTypes: ["Job", "Candidate", "Submission", "RecruiterNote"],
  functions: [
    {
      key: "recruiting.candidate_fit_summary",
      name: "Candidate fit summary",
      description: "Grounded candidate-fit reasoning with a deterministic match score.",
      inputSchema: {
        type: "object",
        properties: { candidateId: { type: "string" }, jobId: { type: "string" } },
        required: ["candidateId", "jobId"],
      },
      outputSchema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          matchScore: { type: "number" },
          recommendedNextAction: { type: "string" },
        },
      },
      handlerKey: "recruiting.candidate_fit_summary",
    },
  ],
  agents: [
    {
      key: "recruiting.shortlist_builder",
      name: "Shortlist builder (v2)",
      description: "Reason over candidate evidence and route to shortlist or review.",
      graph: shortlistBuilderAgentV2("__seed__").graph as unknown as Record<string, unknown>,
    },
  ],
  actions: [
    {
      key: "recruiting.create_recruiter_note",
      name: "Create recruiter note",
      objectType: "RecruiterNote",
      handlerKey: "recruiting.create_recruiter_note",
      inputSchema: {
        type: "object",
        properties: { note: { type: "string" }, candidateId: { type: "string" }, jobId: { type: "string" } },
        required: ["note"],
      },
    },
    {
      key: "recruiting.shortlist_candidate",
      name: "Shortlist candidate",
      objectType: "Submission",
      handlerKey: "recruiting.shortlist_candidate",
      inputSchema: {
        type: "object",
        properties: {
          candidateId: { type: "string" },
          jobId: { type: "string" },
          score: { type: "number" },
          rationale: { type: "string" },
        },
        required: ["candidateId", "jobId", "score"],
      },
    },
  ],
  notificationRules: [
    {
      key: "recruiting.shortlist.created",
      name: "Recruiting shortlist created",
      eventType: "recruiting.shortlist.created",
      channel: "in_app",
      templateKey: "recruiting.shortlist.created",
      config: {},
    },
    {
      key: "recruiting.fit.needs_review",
      name: "Recruiting fit needs review",
      eventType: "recruiting.fit.needs_review",
      channel: "in_app",
      templateKey: "recruiting.fit.needs_review",
      config: {},
    },
  ],
  sampleObjects: [
    {
      objectType: "Job",
      externalKey: "job-powerbi",
      title: "Sr. Power BI Developer",
      status: "open",
      properties: {},
      evidence: ["Requires deep Power BI and DAX modeling experience for enterprise reporting."],
    },
    {
      objectType: "Job",
      externalKey: "job-azure",
      title: "Azure Architect",
      status: "open",
      properties: {},
      evidence: ["Requires Azure solutions architecture, Kubernetes, and Terraform."],
    },
    {
      objectType: "Candidate",
      externalKey: "cand-marcus",
      title: "Marcus Chen",
      status: "active",
      properties: {},
      evidence: ["10 years Power BI and DAX modeling", "Led Azure data warehouse migration"],
    },
    {
      objectType: "Candidate",
      externalKey: "cand-priya",
      title: "Priya Shah",
      status: "active",
      properties: {},
      evidence: ["Azure solutions architect, 8 years", "Kubernetes and Terraform"],
    },
    {
      objectType: "Submission",
      externalKey: "sub-marcus-powerbi",
      title: "Marcus Chen → Sr. Power BI Developer",
      status: "submitted",
      properties: {
        // Canonical ONT-001 keys.
        jobKey: "job-powerbi",
        candidateKey: "cand-marcus",
        stage: "submitted",
        // Legacy aliases retained for backward compatibility (documented shim).
        candidateId: "cand-marcus",
        jobId: "job-powerbi",
      },
    },
  ],
};

registerDomainSeedPack(recruitingSeedPack);

export { shortlistBuilderAgentV2 };
