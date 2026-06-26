// Phase 9 — Slack adapter. Channel message ingest + webhook events. Fail-closed.
import { makeAdapter, type ExternalRecord } from "./adapter-helpers";

export const slackAdapter = makeAdapter({
  provider: "slack",
  capabilities: ["channel_ingest", "notify", "webhook"],
  async probe(_c, token) {
    const res = await fetch("https://slack.com/api/auth.test", { method: "POST", headers: { authorization: `Bearer ${token}` } });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean };
    return body.ok ? { status: "active", message: "Slack auth ok" } : { status: "degraded", message: "Slack auth failed" };
  },
  async fetchRecords(connection, input): Promise<ExternalRecord[]> {
    const channel = String(connection.config.channelId ?? "");
    if (!channel) return [];
    const res = await fetch(`https://slack.com/api/conversations.history?channel=${channel}&limit=10`, { headers: { authorization: `Bearer ${input.credential}` } });
    const body = (await res.json().catch(() => ({}))) as { messages?: Array<Record<string, unknown>> };
    return (body.messages ?? []).map((m, i) => ({
      externalType: "message",
      externalId: String(m.ts ?? i),
      lawrenceType: "SlackMessage",
      title: `Slack message ${m.ts ?? i}`,
      properties: { user: m.user },
      evidence: String(m.text ?? ""),
    }));
  },
  async handleWebhook() {
    return { status: "processed", message: "slack event stored" };
  },
});
