import Link from "next/link";
import { appContext } from "@/lib/app/demo-context";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { Metric, PageHeader, StatusBadge } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function SupportTicketsPage() {
  const ctx = await appContext();
  const tickets = await listObjects(ctx, "SupportTicket");

  return (
    <>
      <PageHeader title="Support Tickets" sub="SupportTicket objects projected from ingested data." />
      <Metric label="Tickets" value={tickets.length} />
      <div className="card">
        <h3>Tickets</h3>
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link href={`/support/tickets/${t.id}`}>{t.title ?? "—"}</Link>
                </td>
                <td>
                  <StatusBadge status={t.status ?? "neutral"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
