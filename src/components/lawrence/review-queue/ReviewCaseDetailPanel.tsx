"use client";

// Phase 5 — review case detail panel (Part E). Shows the selected case fields
// plus the decision bar. Resolving a case refreshes the queue.

import Link from "next/link";
import type { ReviewCase } from "@/types/mission-control";
import {
  domainLabel,
  severityLabel,
  formatRelativeAge,
} from "@/lib/domains/command-center/command-center-formatters";
import { inferDomain } from "@/lib/domains/command-center/command-center-domain";
import { CandidateExtractionPreview } from "./CandidateExtractionPreview";
import { JobExtractionPreview } from "./JobExtractionPreview";
import { ReviewDecisionBar } from "./ReviewDecisionBar";

export function ReviewCaseDetailPanel({
  reviewCase,
  onResolved,
}: {
  reviewCase: ReviewCase;
  onResolved?: () => void;
}) {
  const c = reviewCase;
  const domain = inferDomain(c.subjectObjectType ?? c.caseType);
  const hasSubject = Boolean(c.subjectObjectType && c.subjectObjectId);

  return (
    <div className="card">
      <div className="qtop">
        <span className="badge neutral">{domainLabel(domain)}</span>
        <span className="badge">{c.caseType}</span>
        {c.severity ? <span className="badge">{severityLabel(c.severity)}</span> : null}
        <span className="badge">{c.status}</span>
      </div>

      <h3 style={{ marginTop: 8 }}>{c.summary ?? "Review case"}</h3>

      <div className="kv">
        <span className="muted">Case ID</span>
        <span>{c.id}</span>
      </div>
      <div className="kv">
        <span className="muted">Case type</span>
        <span>{c.caseType}</span>
      </div>
      <div className="kv">
        <span className="muted">Severity</span>
        <span>{severityLabel(c.severity)}</span>
      </div>
      <div className="kv">
        <span className="muted">Status</span>
        <span>{c.status}</span>
      </div>
      <div className="kv">
        <span className="muted">Age</span>
        <span>{formatRelativeAge(c.createdAt)}</span>
      </div>
      <div className="kv">
        <span className="muted">Subject</span>
        <span>
          {hasSubject ? (
            <Link
              href={`/objects/${encodeURIComponent(
                c.subjectObjectType as string,
              )}/${encodeURIComponent(c.subjectObjectId as string)}`}
            >
              {c.subjectObjectType} · {c.subjectObjectId}
            </Link>
          ) : (
            "—"
          )}
        </span>
      </div>

      {c.caseType === "candidate_extraction" && hasSubject ? (
        <CandidateExtractionPreview objectId={c.subjectObjectId as string} />
      ) : null}
      {c.caseType === "job_extraction" && hasSubject ? (
        <JobExtractionPreview objectId={c.subjectObjectId as string} />
      ) : null}

      <h4 style={{ marginTop: 16, marginBottom: 0 }}>Decision</h4>
      <ReviewDecisionBar caseId={c.id} onSettled={onResolved} />
    </div>
  );
}
