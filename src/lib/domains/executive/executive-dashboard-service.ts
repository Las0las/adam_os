// Phase 4 EXECUTIVE / COMMERCIAL OPS — dashboard service. Tenant-scoped counts
// and executive operator cards built from the ontology + review queue, plus a
// Command Center feed of risk signals and decision memos.

import { db } from "@/lib/lawrence-core/db";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import type { ActorContext } from "@/types/platform";
import type {
  DomainDashboard,
  DomainDashboardCard,
  CommandCenterItem,
} from "@/lib/domains/domain-workflow-types";
import type { OntologyObject } from "@/types/dataops";

function propStr(obj: OntologyObject, key: string): string | null {
  const v = obj.properties[key];
  return v == null ? null : String(v);
}

function severityOf(value: string | null): CommandCenterItem["severity"] {
  const s = (value ?? "").toLowerCase();
  if (s === "low" || s === "medium" || s === "high" || s === "critical") return s;
  return null;
}

export async function getExecutiveDashboard(ctx: ActorContext): Promise<DomainDashboard> {
  const accounts = await listObjects(ctx, "Account");
  const opportunities = await listObjects(ctx, "Opportunity");
  const riskSignals = await listObjects(ctx, "RiskSignal");
  const decisionMemos = await listObjects(ctx, "DecisionMemo");

  const highRiskSignals = riskSignals.filter((r) => {
    const sev = (propStr(r, "severity") ?? "").toLowerCase();
    return sev === "high" || sev === "critical";
  });

  const counts: Record<string, number> = {
    accounts: accounts.length,
    opportunities: opportunities.length,
    riskSignals: riskSignals.length,
    decisionMemos: decisionMemos.length,
    highRisk: highRiskSignals.length,
  };

  // Executive Risk Queue: open high-severity executive risk review cases.
  const riskCases = await db.reviewCases.list(
    ctx.tenantId,
    (c) => c.caseType === "executive.risk.high" && c.status === "open",
  );
  const riskQueueItems: DomainDashboardCard["items"] = riskCases.map((rc) => ({
    objectId: rc.subjectObjectId ?? undefined,
    title: rc.summary ?? rc.id,
    severity: rc.severity ?? null,
    status: rc.status,
    nextAction: "review",
  }));

  // Account Risk Briefs: decision memos already drafted per account.
  const briefItems: DomainDashboardCard["items"] = decisionMemos.map((m) => ({
    objectId: m.id,
    title: m.title ?? m.id,
    status: m.status ?? null,
    nextAction: "open_memo",
  }));

  const marginItems: DomainDashboardCard["items"] = riskSignals
    .filter((r) => (propStr(r, "riskType") ?? "").toLowerCase() === "margin")
    .map((r) => ({
      objectId: r.id,
      title: r.title ?? r.id,
      severity: propStr(r, "severity"),
      status: r.status ?? null,
      nextAction: "investigate_margin",
    }));

  const deliveryItems: DomainDashboardCard["items"] = riskSignals
    .filter((r) => (propStr(r, "riskType") ?? "").toLowerCase() === "delivery")
    .map((r) => ({
      objectId: r.id,
      title: r.title ?? r.id,
      severity: propStr(r, "severity"),
      status: r.status ?? null,
      nextAction: "investigate_delivery",
    }));

  const memoItems: DomainDashboardCard["items"] = decisionMemos.map((m) => ({
    objectId: m.id,
    title: m.title ?? m.id,
    status: m.status ?? null,
    nextAction: "open_memo",
  }));

  const cards: DomainDashboardCard[] = [
    { key: "executive_risk_queue", label: "Executive Risk Queue", count: riskQueueItems.length, items: riskQueueItems },
    { key: "account_risk_briefs", label: "Account Risk Briefs", count: briefItems.length, items: briefItems },
    { key: "margin_alerts", label: "Margin Alerts", count: marginItems.length, items: marginItems },
    { key: "delivery_risks", label: "Delivery Risks", count: deliveryItems.length, items: deliveryItems },
    { key: "decision_memos", label: "Decision Memos", count: memoItems.length, items: memoItems },
  ];

  return { domain: "executive", counts, cards };
}

export async function getExecutiveRiskCards(ctx: ActorContext): Promise<CommandCenterItem[]> {
  const riskSignals = await listObjects(ctx, "RiskSignal");
  const decisionMemos = await listObjects(ctx, "DecisionMemo");

  const items: CommandCenterItem[] = [];

  for (const r of riskSignals) {
    items.push({
      domain: "executive",
      kind: "risk",
      title: r.title ?? r.id,
      severity: severityOf(propStr(r, "severity")),
      status: r.status ?? null,
      linkedObjectType: "RiskSignal",
      linkedObjectId: r.id,
      nextAction: "review",
      createdAt: r.createdAt,
    });
  }

  for (const m of decisionMemos) {
    items.push({
      domain: "executive",
      kind: "recommendation",
      title: m.title ?? m.id,
      severity: null,
      status: m.status ?? null,
      linkedObjectType: "DecisionMemo",
      linkedObjectId: m.id,
      nextAction: "open_memo",
      createdAt: m.createdAt,
    });
  }

  return items;
}
