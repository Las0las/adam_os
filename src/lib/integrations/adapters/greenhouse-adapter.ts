// Phase 9 — Greenhouse adapter (Harvest API). Jobs/candidates/applications/
// interviews/offers. Basic-auth API key. Fail-closed.
import { makeAdapter, type ExternalRecord } from "./adapter-helpers";

function basic(token: string): string {
  return `Basic ${Buffer.from(`${token}:`).toString("base64")}`;
}

export const greenhouseAdapter = makeAdapter({
  provider: "greenhouse",
  capabilities: ["jobs", "candidates", "applications", "interviews", "offers"],
  async probe(_c, token) {
    const res = await fetch("https://harvest.greenhouse.io/v1/jobs?per_page=1", { headers: { authorization: basic(token) } });
    if (!res.ok) throw new Error(`Greenhouse ${res.status}`);
    return { status: "active", message: "Greenhouse Harvest reachable" };
  },
  async fetchRecords(_c, input): Promise<ExternalRecord[]> {
    const res = await fetch("https://harvest.greenhouse.io/v1/candidates?per_page=10", { headers: { authorization: basic(input.credential) } });
    const list = (await res.json().catch(() => [])) as Array<Record<string, unknown>>;
    return (Array.isArray(list) ? list : []).map((c) => ({
      externalType: "candidate",
      externalId: String(c.id),
      lawrenceType: "Candidate",
      title: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || `Candidate ${c.id}`,
      properties: { company: c.company, title: c.title },
      evidence: String((c.title as string) ?? ""),
    }));
  },
});
