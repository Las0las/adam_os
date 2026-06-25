import { ObjectDetailFull } from "@/components/lawrence/object-detail/ObjectDetailFull";

export const dynamic = "force-dynamic";

export default function OnboardingCaseDetailPage({ params }: { params: { caseId: string } }) {
  return <ObjectDetailFull objectType="OnboardingCase" objectId={params.caseId} />;
}
