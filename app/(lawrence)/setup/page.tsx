import { SetupWizard } from "@/components/lawrence/setup/SetupWizard";
import { SetupBootstrapPanel } from "@/components/lawrence/setup/SetupBootstrapPanel";
import { PageHeader } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default function SetupPage() {
  return (
    <>
      <PageHeader title="Setup" sub="Bootstrap a tenant into a production-ready operating system." />
      <SetupWizard active="tenant">
        <SetupBootstrapPanel />
      </SetupWizard>
    </>
  );
}
