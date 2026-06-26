// Phase 9 — production readiness. Aggregates platform-state checks into a 0–100
// score with a blockers list. Prod-ready at >= 85. Read-only.

import { db } from "@/lib/lawrence-core/db";
import { now } from "@/lib/lawrence-core/utils/ids";
import { listEnvironments } from "@/lib/mission-control/runtime/environment-repository";
import { listApprovalPolicies } from "@/lib/mission-control/runtime/approval-repository";
import { listActiveKillSwitches } from "@/lib/mission-control/runtime/kill-switch-repository";
import type { ActorContext } from "@/types/platform";

export interface ReadinessCheck {
  key: string;
  label: string;
  passed: boolean;
  severity: "blocker" | "warning";
  detail: string;
}

export interface ReadinessReport {
  generatedAt: string;
  score: number;
  prodReady: boolean;
  checks: ReadinessCheck[];
  blockers: ReadinessCheck[];
}

export async function getProductionReadiness(ctx: ActorContext): Promise<ReadinessReport> {
  const t = ctx.tenantId;
  const [environments, policies, users, models, evalSuites, evalRuns, incidents, killSwitches, packs, audit, integrations] =
    await Promise.all([
      listEnvironments(t),
      listApprovalPolicies(t),
      db.users.list(t),
      db.modelDefinitions.list(t, (m) => m.status === "active"),
      db.evalSuites.list(t),
      db.evalRuns.list(t),
      db.runtimeIncidents.list(t, (i) => i.status !== "resolved" && i.severity === "critical"),
      listActiveKillSwitches(t),
      db.domainPackInstallations.list(t, (i) => i.status === "installed"),
      db.auditEvents.list(t),
      db.integrationConnections.list(t),
    ]);

  const latestEvalsPass = evalRuns.length === 0 || evalRuns.every((r) => r.passed !== false);
  const prodKillSwitches = killSwitches.length; // any active kill switch is a readiness risk
  const integrationsOk = integrations.every((c) => ["active", "not_configured", "disabled"].includes(c.status));

  const def = (key: string, label: string, passed: boolean, severity: "blocker" | "warning", detail: string): ReadinessCheck =>
    ({ key, label, passed, severity, detail });

  const checks: ReadinessCheck[] = [
    def("database", "Database reachable", true, "blocker", "data-access seam responding"),
    def("migrations", "Schema/collections available", true, "blocker", "runtime collections initialized"),
    def("environments", "dev/staging/prod environments exist", environments.length >= 3, "blocker", `${environments.length} environments`),
    def("approval_policies", "Approval policies configured", policies.length > 0, "blocker", `${policies.length} policies`),
    def("admin_user", "At least one user exists", users.length >= 1, "blocker", `${users.length} users`),
    def("model_definitions", "Active model definitions configured", models.length > 0, "warning", `${models.length} active models`),
    def("eval_suites", "Eval suites installed", evalSuites.length > 0, "warning", `${evalSuites.length} suites`),
    def("evals_pass", "Latest evals pass", latestEvalsPass, "warning", latestEvalsPass ? "no failing eval runs" : "a recent eval failed"),
    def("no_critical_incidents", "No active critical incidents", incidents.length === 0, "blocker", `${incidents.length} critical incidents`),
    def("no_prod_kill_switches", "No active kill switches", prodKillSwitches === 0, "warning", `${prodKillSwitches} active kill switches`),
    def("integrations", "Integrations active or skipped", integrationsOk, "warning", "no failed/degraded integrations"),
    def("domain_packs", "Domain packs installed", packs.length > 0, "warning", `${packs.length} packs`),
    def("audit", "Audit events recording", audit.length > 0, "blocker", `${audit.length} audit events`),
    def("notifications", "Notification channel available", true, "warning", "in-app channel always available"),
  ];

  const passed = checks.filter((c) => c.passed).length;
  const score = Math.round((passed / checks.length) * 100);
  const blockers = checks.filter((c) => !c.passed && c.severity === "blocker");

  return {
    generatedAt: now(),
    score,
    prodReady: score >= 85 && blockers.length === 0,
    checks,
    blockers,
  };
}
