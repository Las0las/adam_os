"use client";

// Phase 5 — review case card (Part E). Compact queue card: domain/case-type +
// severity badges, summary, subject object link, age, status. Clicking selects.

import Link from "next/link";
import type { ReviewCase } from "@/types/mission-control";
import {
  domainLabel,
  severityLabel,
  formatRelativeAge,
} from "@/lib/domains/command-center/command-center-formatters";
import { inferDomain } from "@/lib/domains/command-center/command-center-domain";

const SEV_CLASS: Record<string, string> = {
  low: "sev-low",
  medium: "sev-medium",
  high: "sev-high",
  critical: "sev-critical",
};

export function ReviewCaseCard({
  reviewCase,
  selected,
  onSelect,
}: {
  reviewCase: ReviewCase;
  selected?: boolean;
  onSelect?: (reviewCase: ReviewCase) => void;
}) {
  const c = reviewCase;
  const domain = inferDomain(c.subjectObjectType ?? c.caseType);
  const sevClass = c.severity ? SEV_CLASS[c.severity] ?? "sev-low" : "sev-low";
  const hasSubject = Boolean(c.subjectObjectType && c.subjectObjectId);

  return (
    <div
      className="qcard"
      role="button"
      tabIndex={0}
      aria-pressed={selected ? true : undefined}
      style={selected ? { borderColor: "var(--accent)" } : undefined}
      onClick={() => onSelect?.(c)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(c);
        }
      }}
    >
      <div className="qtop">
        <span className="badge neutral">{domainLabel(domain)}</span>
        <span className="badge">{c.caseType}</span>
        {c.severity ? (
          <span className={`badge ${sevClass}`}>{severityLabel(c.severity)}</span>
        ) : null}
      </div>

      <div className="qsummary">{c.summary ?? "No summary provided."}</div>

      {hasSubject ? (
        <div className="qmeta">
          <Link
            href={`/objects/${encodeURIComponent(c.subjectObjectType as string)}/${encodeURIComponent(
              c.subjectObjectId as string,
            )}`}
            onClick={(e) => e.stopPropagation()}
          >
            {c.subjectObjectType} · {c.subjectObjectId}
          </Link>
        </div>
      ) : null}

      <div className="qmeta">
        <span>{formatRelativeAge(c.createdAt)}</span>
        <span className="badge">{c.status}</span>
      </div>
    </div>
  );
}
