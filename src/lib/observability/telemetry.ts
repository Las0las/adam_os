// Error/telemetry export (observability). captureException always emits a
// structured log (the OTel-collector / stdout path) and, when SENTRY_DSN is
// configured, additionally ships the event to Sentry over HTTPS via `fetch` — no
// SDK, matching the repo's install-free pattern. It never throws and never blocks
// the caller's result on the network round-trip; a Sentry failure degrades to a
// logged warning. Secret values are never sent: callers pass summaries/ids only.

import { log } from "./logger";

export interface CaptureContext {
  tenantId?: string | null;
  actorUserId?: string | null;
  component?: string | null;
  traceId?: string | null;
  level?: "error" | "warning";
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

export function isSentryConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.SENTRY_DSN);
}

interface ParsedDsn {
  protocol: string;
  host: string;
  projectId: string;
  publicKey: string;
}

/** Parse a Sentry DSN (`https://{publicKey}@{host}/{projectId}`). */
export function parseSentryDsn(dsn: string): ParsedDsn | null {
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\//, "");
    if (!u.username || !u.host || !projectId) return null;
    return { protocol: u.protocol.replace(":", ""), host: u.host, projectId, publicKey: u.username };
  } catch {
    return null;
  }
}

/** Record an exception: structured log always; Sentry export when configured. */
export async function captureException(error: unknown, context: CaptureContext = {}): Promise<void> {
  const err = error instanceof Error ? error : new Error(String(error));
  const isWarn = context.level === "warning";
  (isWarn ? log.warn : log.error)("exception", {
    message: err.message,
    errorType: err.name,
    tenantId: context.tenantId ?? null,
    actorUserId: context.actorUserId ?? null,
    component: context.component ?? null,
    traceId: context.traceId ?? null,
    ...context.extra,
  });
  if (isSentryConfigured()) {
    try {
      await sendToSentry(err, context);
    } catch (e) {
      log.warn("sentry_export_failed", { reason: e instanceof Error ? e.message : String(e) });
    }
  }
}

function eventId(): string {
  // 32-char hex, per the Sentry event id format.
  return crypto.randomUUID().replace(/-/g, "");
}

async function sendToSentry(err: Error, ctx: CaptureContext): Promise<void> {
  const dsn = parseSentryDsn(process.env.SENTRY_DSN ?? "");
  if (!dsn) return;
  const id = eventId();
  const sentAt = new Date().toISOString();
  const payload = {
    event_id: id,
    timestamp: Date.now() / 1000,
    platform: "node",
    level: ctx.level === "warning" ? "warning" : "error",
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.LAWRENCE_RELEASE,
    exception: { values: [{ type: err.name, value: err.message }] },
    tags: { component: ctx.component ?? "unknown", ...ctx.tags },
    user: ctx.actorUserId ? { id: ctx.actorUserId } : undefined,
    extra: { tenantId: ctx.tenantId ?? null, traceId: ctx.traceId ?? null, stack: err.stack, ...ctx.extra },
  };
  const envelope =
    `${JSON.stringify({ event_id: id, sent_at: sentAt })}\n` +
    `${JSON.stringify({ type: "event" })}\n` +
    `${JSON.stringify(payload)}`;
  await fetch(`${dsn.protocol}://${dsn.host}/api/${dsn.projectId}/envelope/`, {
    method: "POST",
    headers: {
      "content-type": "application/x-sentry-envelope",
      "x-sentry-auth": `Sentry sentry_version=7, sentry_key=${dsn.publicKey}, sentry_client=lawrence/0.1`,
    },
    body: envelope,
  });
}
