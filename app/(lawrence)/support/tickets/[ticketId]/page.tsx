import { appContext } from "@/lib/app/demo-context";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { PageHeader, StatusBadge, Placeholder } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function SupportTicketDetailPage({
  params,
}: {
  params: { ticketId: string };
}) {
  const ctx = await appContext();
  const ticket = (await listObjects(ctx, "SupportTicket")).find((t) => t.id === params.ticketId);

  if (!ticket) {
    return (
      <Placeholder
        title="Ticket not found"
        note={`No SupportTicket object with id ${params.ticketId}.`}
      />
    );
  }

  return (
    <>
      <PageHeader title={ticket.title ?? "Support Ticket"} sub="Support ticket detail" />
      <div className="card">
        <table>
          <tbody>
            <tr>
              <td className="muted">Title</td>
              <td>{ticket.title ?? "—"}</td>
            </tr>
            <tr>
              <td className="muted">Status</td>
              <td>
                <StatusBadge status={ticket.status ?? "neutral"} />
              </td>
            </tr>
            {Object.entries(ticket.properties).map(([k, v]) => (
              <tr key={k}>
                <td className="muted">{k}</td>
                <td>{String(v ?? "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
