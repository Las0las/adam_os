import { SetupWizard } from "@/components/lawrence/setup/SetupWizard";
import { SetupMissionControlPanel } from "@/components/lawrence/setup/SetupMissionControlPanel";
import { PageHeader } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default function SetupMissionControlPage() {
  return (
    <>
      <PageHeader title="Setup · Mission Control" sub="Seed governance: environments and approval policies." />
      <SetupWizard active="mission-control">
        <SetupMissionControlPanel />
      </SetupWizard>
    </>
  );
}
