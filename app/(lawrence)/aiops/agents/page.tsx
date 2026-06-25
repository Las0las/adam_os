import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { shortlistBuilderAgent } from "@/lib/domains/recruiting/recruiting-pack";
import { Metric, PageHeader } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const ctx = await appContext();
  const agent = shortlistBuilderAgent(ctx.tenantId);
  const agentRuns = await db.agentRuns.list(ctx.tenantId);

  return (
    <>
      <PageHeader
        title="Agents"
        sub="Composed, multi-step agents that orchestrate functions, retrieval, and review."
      />
      <div className="grid grid-3">
        <Metric label="Agent runs" value={agentRuns.length} />
        <Metric label="Graph nodes" value={agent.graph.nodes.length} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>{agent.name}</h3>
        <p className="muted">{agent.description ?? "—"}</p>
        <table>
          <thead>
            <tr>
              <th>Node ID</th>
              <th>Kind</th>
            </tr>
          </thead>
          <tbody>
            {agent.graph.nodes.map((n) => (
              <tr key={n.id}>
                <td>
                  <code>{n.id}</code>
                </td>
                <td>
                  <span className="badge neutral">{n.kind}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
