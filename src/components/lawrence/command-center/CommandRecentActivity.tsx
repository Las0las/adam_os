import type { CommandCenterItem } from "@/lib/domains/command-center/command-center-types";
import { domainLabel, formatRelativeAge } from "@/lib/domains/command-center/command-center-formatters";
import { CommandEmptyState } from "./CommandEmptyState";

export function CommandRecentActivity({
  items,
  generatedAt,
}: {
  items: CommandCenterItem[];
  generatedAt: string;
}) {
  return (
    <div className="card">
      <div className="page-title">Recent Activity</div>
      {items.length === 0 ? (
        <CommandEmptyState message="Nothing has happened yet." />
      ) : (
        <table>
          <thead>
            <tr>
              <th>Domain</th>
              <th>Event</th>
              <th>Summary</th>
              <th>Age</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <span className="badge neutral">{domainLabel(item.domain)}</span>
                </td>
                <td>{item.title}</td>
                <td className="muted">{item.summary ?? "—"}</td>
                <td className="muted">{formatRelativeAge(item.createdAt, generatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
