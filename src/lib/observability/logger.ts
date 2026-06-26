// Structured JSON logger (observability export). Emits one JSON object per line
// to stdout/stderr so any aggregator — an OpenTelemetry Collector filelog
// receiver, Datadog, CloudWatch, Loki — can ingest it without an SDK. This is the
// lightweight, install-free export path (matching the repo's fetch-based, lean
// pattern). Level is filtered by LAWRENCE_LOG_LEVEL (default: info).

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function minLevel(env: Record<string, string | undefined> = process.env): LogLevel {
  const v = (env.LAWRENCE_LOG_LEVEL ?? "info").toLowerCase();
  return (["debug", "info", "warn", "error"].includes(v) ? v : "info") as LogLevel;
}

export function logEvent(level: LogLevel, event: string, fields: LogFields = {}): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel()]) return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
  // eslint-disable-next-line no-console
  if (level === "error") console.error(line);
  // eslint-disable-next-line no-console
  else if (level === "warn") console.warn(line);
  // eslint-disable-next-line no-console
  else console.log(line);
}

export const log = {
  debug: (event: string, fields?: LogFields) => logEvent("debug", event, fields),
  info: (event: string, fields?: LogFields) => logEvent("info", event, fields),
  warn: (event: string, fields?: LogFields) => logEvent("warn", event, fields),
  error: (event: string, fields?: LogFields) => logEvent("error", event, fields),
};
