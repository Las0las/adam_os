// Channel registry (§36). Resolves a NotificationChannel to its adapter. The
// registry is mutable so tests (and future runtime configuration) can install a
// configured transport in place of the env-gated defaults.

import type { NotificationChannel } from "@/types/mission-control";
import type { NotificationChannelAdapter } from "./channel-types";
import { InAppChannel } from "./in-app-channel";
import { EmailChannel } from "./email-channel";
import { SlackChannel } from "./slack-channel";
import { WebhookChannel } from "./webhook-channel";

function defaults(): Record<NotificationChannel, NotificationChannelAdapter> {
  return {
    in_app: new InAppChannel(),
    email: new EmailChannel(),
    slack: new SlackChannel(),
    teams: new WebhookChannel("teams"),
    webhook: new WebhookChannel("webhook"),
  };
}

let adapters: Record<NotificationChannel, NotificationChannelAdapter> = defaults();

export function getChannelAdapter(channel: NotificationChannel): NotificationChannelAdapter {
  return adapters[channel];
}

/** Install a custom adapter for a channel (used by tests / runtime config). */
export function setChannelAdapter(
  channel: NotificationChannel,
  adapter: NotificationChannelAdapter,
): void {
  adapters[channel] = adapter;
}

/** Restore the env-gated default adapters. */
export function resetChannelAdapters(): void {
  adapters = defaults();
}
