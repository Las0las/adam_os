"use client";

// Recruiting assistant front door. Two governed entry points over one text box:
//   - "Run command"  -> POST /api/recruiting/chat   (NL intent -> governed action)
//   - "Create from profile" -> POST /api/recruiting/candidates/extract (draft -> review)
// Neither mutates records directly; results surface status + a link into the
// review queue when human approval is pending.

import { useState } from "react";
import Link from "next/link";

interface ChatData {
  intent: string;
  status: string;
  message: string;
  reviewCaseId?: string;
  candidateId?: string;
  executionId?: string;
}

interface ExtractData {
  reviewCaseId: string;
  extractionId: string;
  status: string;
  confidence: number;
  proposed: { fullName?: string | null; email?: string | null };
}

type Result =
  | { kind: "chat"; data: ChatData }
  | { kind: "extract"; data: ExtractData };

const GOOD = new Set(["executed", "draft", "pending_approval", "pending_review"]);
const BAD = new Set(["blocked"]);

function badgeClass(status: string): string {
  if (GOOD.has(status)) return "badge ok";
  if (BAD.has(status)) return "badge bad";
  return "badge"; // needs_clarification / unsupported / other
}

export function RecruitingAssistantClient() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function post<T>(url: string, body: unknown): Promise<T | null> {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { ok?: boolean; data?: T; error?: string };
      if (!res.ok || json.ok === false) {
        setError(json.error ?? `Request failed (${res.status})`);
        return null;
      }
      return (json.data ?? (json as unknown as T)) ?? null;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function runCommand() {
    if (!text.trim()) return;
    const data = await post<ChatData>("/api/recruiting/chat", { message: text });
    if (data) setResult({ kind: "chat", data });
  }

  async function createFromProfile() {
    if (!text.trim()) return;
    const data = await post<ExtractData>("/api/recruiting/candidates/extract", { text });
    if (data) setResult({ kind: "extract", data });
  }

  const reviewCaseId =
    result?.kind === "chat" ? result.data.reviewCaseId : result?.data.reviewCaseId;
  const status = result ? result.data.status : null;
  const message =
    result?.kind === "chat"
      ? result.data.message
      : result
        ? `Drafted ${result.data.proposed.fullName ?? result.data.proposed.email ?? "candidate"} ` +
          `(confidence ${result.data.confidence}) — pending review.`
        : null;

  return (
    <>
      <h1 className="page-title">Recruiting Assistant</h1>
      <p className="muted">
        Type a command (&quot;move Dana to interview&quot;, &quot;note on Sam: strong backend&quot;)
        or paste a candidate&apos;s profile. Stage changes and new candidates go through approval —
        nothing is written directly.
      </p>

      <div className="card" style={{ marginTop: 16 }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a command, or paste a LinkedIn/CV profile…"
          rows={8}
          style={{ width: "100%", resize: "vertical" }}
          disabled={busy}
        />
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button className="btn" onClick={runCommand} disabled={busy || !text.trim()}>
            Run command
          </button>
          <button className="btn secondary" onClick={createFromProfile} disabled={busy || !text.trim()}>
            Create from pasted profile
          </button>
          {busy ? <span className="muted">Working…</span> : null}
        </div>
      </div>

      {error ? (
        <div className="card" style={{ marginTop: 16 }}>
          <span className="badge bad">Error</span>
          <p className="muted">{error}</p>
        </div>
      ) : null}

      {result && status ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="qtop">
            <span className={badgeClass(status)}>{status.replace(/_/g, " ")}</span>
            {result.kind === "chat" ? <span className="badge">{result.data.intent}</span> : null}
          </div>
          <p style={{ marginTop: 8 }}>{message}</p>
          {reviewCaseId ? (
            <p className="muted">
              Awaiting review —{" "}
              <Link href="/command-center/review-queue">open the review queue</Link> to approve.
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
