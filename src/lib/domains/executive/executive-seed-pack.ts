// Phase 4 EXECUTIVE / COMMERCIAL OPS — domain seed pack. Declares ontology types,
// the account-risk-brief function, the commercial-risk-monitor agent, the
// decision-memo action, notification rules, and sample accounts/opportunities/
// risk signals. Side-effect imports register the function and action handlers;
// registerDomainSeedPack registers the pack for install.

import "./executive-functions";
import "./executive-actions";

import { registerDomainSeedPack } from "@/lib/domains/domain-seed-runner";
import { commercialRiskMonitorAgentV2 } from "./executive-agent-graphs";
import { getExecutiveRiskCards } from "./executive-dashboard-service";
import type { DomainSeedPack } from "@/lib/domains/domain-seed-types";

export const executiveSeedPack: DomainSeedPack = {
  key: "executive",
  name: "Executive / Commercial Ops",
  description:
    "Live executive workflow: account-risk reasoning, decision-memo drafting, and high-risk review routing.",
  objectTypes: ["Account", "Opportunity", "RiskSignal", "DecisionMemo"],
  functions: [
    {
      key: "executive.account_risk_brief",
      name: "Account risk brief",
      description: "Grounded account-risk reasoning with a deterministic risk score and recommended actions.",
      inputSchema: {
        type: "object",
        properties: { accountId: { type: "string" } },
        required: ["accountId"],
      },
      outputSchema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          riskScore: { type: "number" },
          topRisks: { type: "array", items: { type: "object" } },
          recommendedActions: { type: "array", items: { type: "object" } },
        },
      },
      handlerKey: "executive.account_risk_brief",
    },
  ],
  agents: [
    {
      key: "executive.commercial_risk_monitor",
      name: "Commercial risk monitor (v2)",
      description: "Reason over account risk evidence and route high-risk accounts to review.",
      graph: commercialRiskMonitorAgentV2("__seed__").graph as unknown as Record<string, unknown>,
    },
  ],
  actions: [
    {
      key: "executive.create_decision_memo",
      name: "Create decision memo",
      objectType: "DecisionMemo",
      handlerKey: "executive.create_decision_memo",
      inputSchema: {
        type: "object",
        properties: {
          accountId: { type: "string" },
          title: { type: "string" },
          summary: { type: "string" },
          recommendedActions: { type: "array" },
          evidenceRefs: { type: "array" },
          riskScore: { type: "number" },
        },
        required: ["accountId", "title"],
      },
    },
  ],
  notificationRules: [
    {
      key: "executive.risk.high",
      name: "Executive high risk",
      eventType: "executive.risk.high",
      channel: "in_app",
      templateKey: "executive.risk.high",
      config: {},
    },
    {
      key: "executive.decision_memo.created",
      name: "Executive decision memo created",
      eventType: "executive.decision_memo.created",
      channel: "in_app",
      templateKey: "executive.decision_memo.created",
      config: {},
    },
  ],
  sampleObjects: [
    {
      objectType: "Account",
      externalKey: "acct-meridian",
      title: "Meridian Health",
      status: "active",
      properties: {},
      evidence: [
        "Rate pressure increasing on delivery",
        "SLA risk on ML engineer staffing",
        "Candidate scarcity for senior ML roles",
      ],
    },
    {
      objectType: "Opportunity",
      externalKey: "opp-mleng",
      title: "Sr. ML Engineer Delivery",
      status: "negotiation",
      properties: { accountId: "acct-meridian", value: 240000 },
    },
    {
      objectType: "RiskSignal",
      externalKey: "risk-margin",
      title: "Margin risk",
      properties: { accountId: "acct-meridian", objectId: "acct-meridian", riskType: "margin", severity: "high" },
    },
    {
      objectType: "RiskSignal",
      externalKey: "risk-delivery",
      title: "Delivery risk",
      properties: { accountId: "acct-meridian", objectId: "acct-meridian", riskType: "delivery", severity: "critical" },
    },
  ],
};

registerDomainSeedPack(executiveSeedPack);

export { commercialRiskMonitorAgentV2, getExecutiveRiskCards };
