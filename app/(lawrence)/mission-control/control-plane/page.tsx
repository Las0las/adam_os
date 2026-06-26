// Phase 6 — Mission Control control-plane page. Server component that renders
// the client root and forces dynamic rendering so the overview is always live.

import { MissionControlPage } from "@/components/lawrence/mission-control/MissionControlPage";

export const dynamic = "force-dynamic";

export default function ControlPlanePage() {
  return <MissionControlPage />;
}
