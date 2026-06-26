import { SetupWizard } from "@/components/lawrence/setup/SetupWizard";
import { PageHeader } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default function SetupCompletePage() {
  return (
    <>
      <PageHeader title="Setup complete" sub="Your tenant is configured. Verify it is production-ready." />
      <SetupWizard active="complete">
        <div className="card">
          <strong>You're set up</strong>
          <p className="muted" style={{ marginTop: 4 }}>
            The tenant has been bootstrapped with environments, approval policies,
            domain packs, and (optionally) integrations.
          </p>
          <ul style={{ marginTop: 8 }}>
            <li>
              <a href="/mission-control/readiness">Check production readiness</a>
            </li>
            <li>
              <a href="/mission-control">Open Mission Control</a>
            </li>
            <li>
              <a href="/settings/integrations">Manage integrations</a>
            </li>
            <li>
              <a href="/domain-packs">Manage domain packs</a>
            </li>
          </ul>
        </div>
      </SetupWizard>
    </>
  );
}
