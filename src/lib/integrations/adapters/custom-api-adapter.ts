// Phase 9 — Custom API adapter. Config: { baseUrl, authType, healthPath,
// listPath, objectType }. Tests a health endpoint and ingests list payloads as
// ontology objects. Fail-closed; never executes unsafe writes externally.
import { makeAdapter, type ExternalRecord } from "./adapter-helpers";

function authHeader(authType: string, token: string): Record<string, string> {
  if (authType === "bearer") return { authorization: `Bearer ${token}` };
  if (authType === "header") return { "x-api-key": token };
  return {};
}

export const customApiAdapter = makeAdapter({
  provider: "custom_api",
  capabilities: ["health_check", "list_ingest"],
  async probe(connection, token) {
    const base = String(connection.config.baseUrl ?? "");
    const healthPath = String(connection.config.healthPath ?? "/health");
    if (!base) return { status: "degraded", message: "custom_api missing baseUrl" };
    const res = await fetch(`${base}${healthPath}`, { headers: authHeader(String(connection.config.authType ?? "bearer"), token) });
    if (!res.ok) throw new Error(`custom_api ${res.status}`);
    return { status: "active", message: "custom API reachable" };
  },
  async fetchRecords(connection, input): Promise<ExternalRecord[]> {
    const base = String(connection.config.baseUrl ?? "");
    const listPath = String(connection.config.listPath ?? "");
    const objectType = String(connection.config.objectType ?? "ExternalRecord");
    if (!base || !listPath) return [];
    const res = await fetch(`${base}${listPath}`, { headers: authHeader(String(connection.config.authType ?? "bearer"), input.credential) });
    const list = (await res.json().catch(() => [])) as Array<Record<string, unknown>>;
    return (Array.isArray(list) ? list : []).map((r, i) => ({
      externalType: objectType,
      externalId: String(r.id ?? i),
      lawrenceType: objectType,
      title: String(r.title ?? r.name ?? `${objectType} ${r.id ?? i}`),
      properties: r,
    }));
  },
});
