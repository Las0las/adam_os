// Phase 9 — Google Workspace adapter (Gmail/Calendar/Drive). Fail-closed.
import { makeAdapter, type ExternalRecord } from "./adapter-helpers";

async function gapiGet(url: string, token: string): Promise<unknown> {
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Google API ${res.status}`);
  return res.json();
}

export const googleWorkspaceAdapter = makeAdapter({
  provider: "google_workspace",
  capabilities: ["gmail", "calendar", "drive_docs"],
  async probe(_c, token) {
    await gapiGet("https://gmail.googleapis.com/gmail/v1/users/me/profile", token);
    return { status: "active", message: "Gmail API reachable" };
  },
  async fetchRecords(_c, input): Promise<ExternalRecord[]> {
    const data = (await gapiGet("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10", input.credential)) as { messages?: Array<{ id: string }> };
    return (data.messages ?? []).map((m) => ({
      externalType: "message",
      externalId: m.id,
      lawrenceType: "EmailMessage",
      title: `Gmail message ${m.id}`,
      properties: { source: "gmail" },
    }));
  },
});
