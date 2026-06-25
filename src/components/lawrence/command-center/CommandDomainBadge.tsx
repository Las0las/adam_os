import type { CommandDomain } from "@/lib/domains/command-center/command-center-types";
import { domainLabel } from "@/lib/domains/command-center/command-center-formatters";

export function CommandDomainBadge({ domain }: { domain: CommandDomain }) {
  return <span className="badge neutral">{domainLabel(domain)}</span>;
}
