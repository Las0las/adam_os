// In-app channel (§36). Always "configured" — in-app notifications are stored
// rows in the platform, requiring no external transport. The engine handles the
// actual persistence; this adapter exists so the channel registry is uniform.

import type {
  ChannelMessage,
  ChannelSendResult,
  NotificationChannelAdapter,
} from "./channel-types";

export class InAppChannel implements NotificationChannelAdapter {
  readonly channel = "in_app" as const;

  isConfigured(): boolean {
    return true;
  }

  async send(_message: ChannelMessage): Promise<ChannelSendResult> {
    // Delivery is the persisted notification row itself; nothing external.
    return { ok: true };
  }
}
