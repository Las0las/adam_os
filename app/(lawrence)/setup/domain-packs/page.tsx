import { SetupWizard } from "@/components/lawrence/setup/SetupWizard";
import { SetupDomainPacksPanel } from "@/components/lawrence/setup/SetupDomainPacksPanel";
import { PageHeader } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default function SetupDomainPacksPage() {
  return (
    <>
      <PageHeader title="Setup · Domain packs" sub="Install the domain packs that power this tenant's operating system." />
      <SetupWizard active="domain-packs">
        <SetupDomainPacksPanel />
      </SetupWizard>
    </>
  );
}
