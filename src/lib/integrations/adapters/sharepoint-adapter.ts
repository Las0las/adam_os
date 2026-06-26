// Phase 9 — SharePoint / OneDrive adapter (Graph drives). Document refs +
// chunking through DataOps. Fail-closed.
import { makeAdapter, type ExternalRecord } from "./adapter-helpers";

export const sharepointAdapter = makeAdapter({
  provider: "sharepoint",
  capabilities: ["document_listing", "file_ingest", "metadata_sync"],
  async probe(_c, token) {
    const res = await fetch("https://graph.microsoft.com/v1.0/sites?search=*", { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Graph ${res.status}`);
    return { status: "active", message: "SharePoint reachable" };
  },
  async fetchRecords(connection, input): Promise<ExternalRecord[]> {
    const driveId = String(connection.config.driveId ?? "");
    if (!driveId) return [];
    const res = await fetch(`https://graph.microsoft.com/v1.0/drives/${driveId}/root/children`, { headers: { authorization: `Bearer ${input.credential}` } });
    const body = (await res.json().catch(() => ({}))) as { value?: Array<Record<string, unknown>> };
    return (body.value ?? []).map((f) => ({
      externalType: "driveItem",
      externalId: String(f.id),
      lawrenceType: "KnowledgeDocument",
      title: String(f.name ?? "document"),
      properties: { webUrl: f.webUrl, size: f.size },
    }));
  },
});
