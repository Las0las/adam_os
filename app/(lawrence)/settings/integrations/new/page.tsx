import { CreateIntegrationDialog } from "@/components/lawrence/integrations/CreateIntegrationDialog";
import { PageHeader } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default function NewIntegrationPage() {
  return (
    <>
      <PageHeader title="New integration connection" sub="Connect an enterprise system. Supply a credential reference name, never a secret." />
      <CreateIntegrationDialog />
    </>
  );
}
