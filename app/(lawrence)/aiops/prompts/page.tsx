import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { PageHeader, Placeholder, StatusBadge } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function PromptsPage() {
  const ctx = await appContext();
  const prompts = await db.promptTemplates.list(ctx.tenantId);

  if (prompts.length === 0) {
    return (
      <>
        <PageHeader title="Prompts" />
        <Placeholder title="No prompt templates" note="Prompt templates register at runtime." />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Prompts" />
      <div className="card">
        <h3>Prompt templates</h3>
        <table>
          <thead>
            <tr>
              <th>Key</th>
              <th>Name</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {prompts.map((p) => (
              <tr key={p.id}>
                <td>
                  <code>{p.key}</code>
                </td>
                <td>{p.name}</td>
                <td>
                  <StatusBadge status={p.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
