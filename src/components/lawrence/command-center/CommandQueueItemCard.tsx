"use client";

import Link from "next/link";
import type { CommandCenterItem } from "@/lib/domains/command-center/command-center-types";
import { statusLabel, formatRelativeAge } from "@/lib/domains/command-center/command-center-formatters";
import { CommandDomainBadge } from "./CommandDomainBadge";
import { CommandSeverityBadge } from "./CommandSeverityBadge";
import { CommandActionButtons } from "./CommandActionButtons";

export function CommandQueueItemCard({
  item,
  generatedAt,
  onSettled,
}: {
  item: CommandCenterItem;
  generatedAt: string;
  onSettled?: () => void;
}) {
  const objectRef = item.objectRef ?? null;
  const excerpt = item.evidenceRefs?.[0]?.excerpt ?? null;

  const titleArea = (
    <>
      <div className="qtop">
        <CommandDomainBadge domain={item.domain} />
        <CommandSeverityBadge severity={item.severity} />
        <span className="badge">{statusLabel(item.status)}</span>
      </div>
      <div className="qtitle">{item.title}</div>
      {item.summary ? <div className="qsummary">{item.summary}</div> : null}
      <div className="qmeta">
        <span>{formatRelativeAge(item.createdAt, generatedAt)}</span>
        {objectRef ? <span> · {objectRef.objectType}</span> : null}
      </div>
      {excerpt ? <div className="qexcerpt">{excerpt}</div> : null}
    </>
  );

  return (
    <div className="qcard">
      {objectRef ? (
        <Link href={`/objects/${objectRef.objectType}/${objectRef.objectId}`}>{titleArea}</Link>
      ) : (
        titleArea
      )}
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="presentation"
      >
        <CommandActionButtons item={item} onSettled={onSettled} />
      </div>
    </div>
  );
}
