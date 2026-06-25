import { appContext } from "@/lib/app/demo-context";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { PageHeader, StatusBadge } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const ctx = await appContext();
  const tickets = await listObjects(ctx, "SupportTicket");
  const kb = await listObjects(ctx, "KnowledgeDocument");
  return (
    <>
      <PageHeader title="Support" sub="Seed domain pack — tickets and knowledge base." />
      <div className="grid grid-2">
        <div className="card">
          <h3>Tickets</h3>
          {tickets.length === 0 ? (
            <p className="muted">No tickets.</p>
          ) : (
            tickets.map((t) => (
              <div className="row" key={t.id}>
                <span>{t.title}</span>
                <StatusBadge status={t.status ?? "open"} />
              </div>
            ))
          )}
        </div>
        <div className="card">
          <h3>Knowledge base</h3>
          {kb.map((d) => (
            <div className="row" key={d.id}>
              <span>{d.title}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
