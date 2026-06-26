// Phase 9 — Microsoft 365 adapter (Graph API). Outlook mail + calendar ingest;
// SharePoint/OneDrive doc refs when configured. Fail-closed without credential.
import { makeAdapter, type ExternalRecord } from "./adapter-helpers";

async function graphGet(path: string, token: string): Promise<unknown> {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Graph ${res.status}`);
  return res.json();
}

export const microsoft365Adapter = makeAdapter({
  provider: "microsoft365",
  capabilities: ["outlook_mail", "calendar", "teams_notify", "sharepoint_docs"],
  async probe(_c, token) {
    await graphGet("/me", token);
    return { status: "active", message: "Microsoft Graph reachable" };
  },
  async fetchRecords(_c, input): Promise<ExternalRecord[]> {
    const data = (await graphGet("/me/messages?$top=10", input.credential)) as { value?: Array<Record<string, unknown>> };
    return (data.value ?? []).map((m) => ({
      externalType: "message",
      externalId: String(m.id),
      lawrenceType: "EmailMessage",
      title: String(m.subject ?? "(no subject)"),
      properties: { from: m.from, receivedDateTime: m.receivedDateTime },
      evidence: String((m.bodyPreview as string) ?? ""),
    }));
  },
});
