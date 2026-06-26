// Phase 9 — Gusto adapter. Employees/onboarding/payroll metadata. Fail-closed.
import { makeAdapter, type ExternalRecord } from "./adapter-helpers";

export const gustoAdapter = makeAdapter({
  provider: "gusto",
  capabilities: ["employees", "onboarding_status", "payroll_setup"],
  async probe(_c, token) {
    const res = await fetch("https://api.gusto.com/v1/me", { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Gusto ${res.status}`);
    return { status: "active", message: "Gusto reachable" };
  },
  async fetchRecords(connection, input): Promise<ExternalRecord[]> {
    const companyId = String(connection.config.companyId ?? "");
    if (!companyId) return [];
    const res = await fetch(`https://api.gusto.com/v1/companies/${companyId}/employees`, { headers: { authorization: `Bearer ${input.credential}` } });
    const list = (await res.json().catch(() => [])) as Array<Record<string, unknown>>;
    return (Array.isArray(list) ? list : []).map((e) => ({
      externalType: "employee",
      externalId: String(e.uuid ?? e.id),
      lawrenceType: "OnboardingCase",
      title: `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim() || "New hire",
      properties: { onboarded: e.onboarded, jobs: e.jobs },
    }));
  },
});
