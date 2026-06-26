import { SetupWizard } from "@/components/lawrence/setup/SetupWizard";
import { IntegrationCatalog } from "@/components/lawrence/integrations/IntegrationCatalog";
import { PageHeader } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default function SetupIntegrationsPage() {
  return (
    <>
      <PageHeader title="Setup · Integrations" sub="Optionally connect enterprise systems for this tenant." />
      <SetupWizard active="integrations">
        <IntegrationCatalog />
      </SetupWizard>
    </>
  );
}
