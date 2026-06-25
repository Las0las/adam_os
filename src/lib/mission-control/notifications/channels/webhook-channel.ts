// Generic webhook channel (§36, §47). POSTs a JSON payload to the destination
// URL. Serves the "webhook" and "teams" channels (both consume an incoming
// webhook URL). Gated on an operator opt-in flag so external POSTs are never
// attempted by default.

import type { NotificationChannel } from "@/types/mission-control";
import type {
  ChannelMessage,
  ChannelSendResult,
  NotificationChannelAdapter,
} from "./channel-types";
import { readErrorBody } from "./channel-types";

export class WebhookChannel implements NotificationChannelAdapter {
  constructor(readonly channel: NotificationChannel) {}

  isConfigured(): boolean {
    return process.env.LAWRENCE_WEBHOOK_ENABLED === "1";
  }

  async send(message: ChannelMessage): Promise<ChannelSendResult> {
    try {
      const res = await fetch(message.destination, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channel: this.channel,
          title: message.title,
          body: message.body,
          deepLink: message.deepLink ?? null,
        }),
      });
      if (!res.ok) {
        return { ok: false, error: `Webhook ${res.status}: ${await readErrorBody(res)}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
