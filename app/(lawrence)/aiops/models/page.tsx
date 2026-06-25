import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { DEFAULT_MODELS } from "@/config/models/default-models";
import { Metric, PageHeader } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function ModelsPage() {
  const ctx = await appContext();
  const defs = await db.modelDefinitions.list(ctx.tenantId);

  return (
    <>
      <PageHeader title="Models" />
      <div className="grid grid-3">
        <Metric label="Model definitions" value={defs.length} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Default models</h3>
        <table>
          <thead>
            <tr>
              <th>Key</th>
              <th>Provider</th>
              <th>Model key</th>
              <th>Purpose</th>
            </tr>
          </thead>
          <tbody>
            {DEFAULT_MODELS.map((m) => (
              <tr key={m.key}>
                <td>
                  <code>{m.key}</code>
                </td>
                <td>{m.provider}</td>
                <td>{m.modelKey}</td>
                <td>{m.purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
