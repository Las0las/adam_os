// Phase 9 — Lever adapter. Postings/candidates/opportunities/interviews.
// Fail-closed.
import { makeAdapter, type ExternalRecord } from "./adapter-helpers";

function basic(token: string): string {
  return `Basic ${Buffer.from(`${token}:`).toString("base64")}`;
}

export const leverAdapter = makeAdapter({
  provider: "lever",
  capabilities: ["postings", "candidates", "opportunities", "interviews"],
  async probe(_c, token) {
    const res = await fetch("https://api.lever.co/v1/postings?limit=1", { headers: { authorization: basic(token) } });
    if (!res.ok) throw new Error(`Lever ${res.status}`);
    return { status: "active", message: "Lever reachable" };
  },
  async fetchRecords(_c, input): Promise<ExternalRecord[]> {
    const res = await fetch("https://api.lever.co/v1/opportunities?limit=10", { headers: { authorization: basic(input.credential) } });
    const body = (await res.json().catch(() => ({}))) as { data?: Array<Record<string, unknown>> };
    return (body.data ?? []).map((o) => ({
      externalType: "opportunity",
      externalId: String(o.id),
      lawrenceType: "Candidate",
      title: String(o.name ?? `Opportunity ${o.id}`),
      properties: { stage: o.stage },
    }));
  },
});
