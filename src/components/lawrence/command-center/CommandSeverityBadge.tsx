import type { CommandSeverity } from "@/lib/domains/command-center/command-center-types";
import { severityLabel } from "@/lib/domains/command-center/command-center-formatters";

export function CommandSeverityBadge({ severity }: { severity?: CommandSeverity | null }) {
  if (!severity) return null;
  return <span className={`badge sev-${severity}`}>{severityLabel(severity)}</span>;
}
