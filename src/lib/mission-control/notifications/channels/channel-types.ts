// Notification channel adapter contract (§36, §47). Each external channel knows
// whether it has transport credentials configured and how to perform a real
// send. The in-app channel always delivers internally; external channels only
// transmit when both an adapter is configured AND the destination is
// allowlisted — otherwise the engine records an internal notification only.

import type { NotificationChannel } from "@/types/mission-control";

export interface ChannelMessage {
  title: string;
  body: string;
  /** Allowlisted external destination (webhook URL, email address, etc.). */
  destination: string;
  deepLink?: string | null;
}

export interface ChannelSendResult {
  ok: boolean;
  error?: string | null;
}

export interface NotificationChannelAdapter {
  readonly channel: NotificationChannel;
  /** True when external transport credentials/config are present for sending. */
  isConfigured(): boolean;
  /**
   * Perform a real external send. Only invoked by the engine when isConfigured()
   * is true and the destination is allowlisted.
   */
  send(message: ChannelMessage): Promise<ChannelSendResult>;
}

/** Shared error-body reader for HTTP-based channels. */
export async function readErrorBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return res.statusText;
  }
}
