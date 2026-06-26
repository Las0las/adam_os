// Observability export: structured logger + telemetry (Sentry over fetch, no SDK).
import { test } from "node:test";
import assert from "node:assert/strict";
import { log, logEvent } from "@/lib/observability/logger";
import {
  captureException,
  parseSentryDsn,
  isSentryConfigured,
} from "@/lib/observability/telemetry";

interface ConsoleCapture {
  lines: string[];
  restore: () => void;
}
function captureConsole(): ConsoleCapture {
  const lines: string[] = [];
  const orig = { log: console.log, warn: console.warn, error: console.error };
  const sink = (l: unknown) => {
    lines.push(String(l));
  };
  console.log = sink as typeof console.log;
  console.warn = sink as typeof console.warn;
  console.error = sink as typeof console.error;
  return {
    lines,
    restore: () => {
      console.log = orig.log;
      console.warn = orig.warn;
      console.error = orig.error;
    },
  };
}

test("logger emits one JSON line with level, event, and fields", () => {
  const cap = captureConsole();
  try {
    log.info("thing_happened", { tenantId: "tnt_x", count: 3 });
  } finally {
    cap.restore();
  }
  assert.equal(cap.lines.length, 1);
  const rec = JSON.parse(cap.lines[0] ?? "{}");
  assert.equal(rec.level, "info");
  assert.equal(rec.event, "thing_happened");
  assert.equal(rec.tenantId, "tnt_x");
  assert.equal(rec.count, 3);
  assert.ok(typeof rec.ts === "string");
});

test("logger suppresses below the configured level", () => {
  const prev = process.env.LAWRENCE_LOG_LEVEL;
  process.env.LAWRENCE_LOG_LEVEL = "warn";
  const cap = captureConsole();
  try {
    logEvent("info", "should_be_suppressed");
    logEvent("error", "should_pass");
  } finally {
    cap.restore();
    if (prev === undefined) delete process.env.LAWRENCE_LOG_LEVEL;
    else process.env.LAWRENCE_LOG_LEVEL = prev;
  }
  assert.equal(cap.lines.length, 1);
  assert.match(cap.lines[0] ?? "", /should_pass/);
});

test("parseSentryDsn extracts host, project, and key", () => {
  const dsn = parseSentryDsn("https://abc123@o1.ingest.sentry.io/42");
  assert.equal(dsn?.host, "o1.ingest.sentry.io");
  assert.equal(dsn?.projectId, "42");
  assert.equal(dsn?.publicKey, "abc123");
  assert.equal(parseSentryDsn("not a dsn"), null);
});

test("captureException logs a structured error and does not call Sentry when unconfigured", async () => {
  const prev = process.env.SENTRY_DSN;
  delete process.env.SENTRY_DSN;
  assert.equal(isSentryConfigured(), false);
  const origFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response("{}");
  }) as typeof fetch;
  const cap = captureConsole();
  try {
    await captureException(new Error("boom"), { tenantId: "tnt_x", component: "api_route" });
  } finally {
    cap.restore();
    globalThis.fetch = origFetch;
    if (prev !== undefined) process.env.SENTRY_DSN = prev;
  }
  assert.equal(fetchCalls, 0, "no Sentry call when DSN absent");
  const rec = JSON.parse(cap.lines.at(-1) ?? "{}");
  assert.equal(rec.event, "exception");
  assert.equal(rec.message, "boom");
  assert.equal(rec.component, "api_route");
});

test("captureException posts a Sentry envelope when SENTRY_DSN is set", async () => {
  const prev = process.env.SENTRY_DSN;
  process.env.SENTRY_DSN = "https://pub@o9.ingest.sentry.io/77";
  const origFetch = globalThis.fetch;
  let url = "";
  let auth = "";
  let body = "";
  globalThis.fetch = (async (u: string | URL | Request, init?: RequestInit) => {
    url = String(u);
    auth = String((init?.headers as Record<string, string>)["x-sentry-auth"] ?? "");
    body = String(init?.body ?? "");
    return new Response("{}");
  }) as typeof fetch;
  const cap = captureConsole();
  try {
    await captureException(new Error("kaboom"), { component: "agent", traceId: "arun_1" });
  } finally {
    cap.restore();
    globalThis.fetch = origFetch;
    if (prev === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = prev;
  }
  assert.match(url, /\/api\/77\/envelope\/$/);
  assert.match(auth, /sentry_key=pub/);
  // Envelope = header + item header + payload (3 newline-delimited JSON lines).
  const parts = body.split("\n");
  assert.equal(parts.length, 3);
  const payload = JSON.parse(parts[2] ?? "{}");
  assert.equal(payload.exception.values[0].value, "kaboom");
  assert.equal(payload.tags.component, "agent");
});
