// Slack channel (§36, §47). Posts to a Slack Incoming Webhook URL. The webhook
// URL is the destination (per-rule, allowlisted). "Configured" means Slack
// delivery is enabled for the process — gated on an env flag so that, absent
// explicit operator opt-in, external Slack traffic is never attempted and the
// engine records an internal notification only.

import type {
  ChannelMessage,
  ChannelSendResult,
  NotificationChannelAdapter,
} from "./channel-types";
import { readErrorBody } from "./channel-types";

export class SlackChannel implements NotificationChannelAdapter {
  readonly channel = "slack" as const;

  isConfigured(): boolean {
    // Operator opt-in. The per-rule destination supplies the webhook URL; this
    // flag confirms the platform is permitted to make external Slack calls.
    return process.env.LAWRENCE_SLACK_ENABLED === "1";
  }

  async send(message: ChannelMessage): Promise<ChannelSendResult> {
    const text = message.deepLink
      ? `*${message.title}*\n${message.body}\n${message.deepLink}`
      : `*${message.title}*\n${message.body}`;
    try {
      const res = await fetch(message.destination, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        return { ok: false, error: `Slack webhook ${res.status}: ${await readErrorBody(res)}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
