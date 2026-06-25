import { ObjectDetailFull } from "@/components/lawrence/object-detail/ObjectDetailFull";

export const dynamic = "force-dynamic";

export default function JobDetailPage({ params }: { params: { jobId: string } }) {
  return <ObjectDetailFull objectType="Job" objectId={params.jobId} />;
}
