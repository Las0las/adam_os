// Email channel (§36, §47). Sends via the Resend HTTP API. "Configured" requires
// both an API key and a verified from-address — absent either, external email is
// never attempted and the engine records an internal notification only. The
// destination is the recipient email address (per-rule, allowlisted).

import type {
  ChannelMessage,
  ChannelSendResult,
  NotificationChannelAdapter,
} from "./channel-types";
import { readErrorBody } from "./channel-types";

const RESEND_SEND_URL = "https://api.resend.com/emails";

export class EmailChannel implements NotificationChannelAdapter {
  readonly channel = "email" as const;

  isConfigured(): boolean {
    return Boolean(process.env.RESEND_API_KEY && process.env.LAWRENCE_EMAIL_FROM);
  }

  async send(message: ChannelMessage): Promise<ChannelSendResult> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.LAWRENCE_EMAIL_FROM;
    if (!apiKey || !from) {
      // isConfigured() gates this, but stay fail-closed if called directly.
      return { ok: false, error: "email transport not configured" };
    }
    const html = message.deepLink
      ? `<p>${escapeHtml(message.body)}</p><p><a href="${message.deepLink}">Open in LAWRENCE</a></p>`
      : `<p>${escapeHtml(message.body)}</p>`;
    try {
      const res = await fetch(RESEND_SEND_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from,
          to: [message.destination],
          subject: message.title,
          html,
        }),
      });
      if (!res.ok) {
        return { ok: false, error: `Resend ${res.status}: ${await readErrorBody(res)}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
