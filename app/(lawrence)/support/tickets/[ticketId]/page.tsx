import { ObjectDetailFull } from "@/components/lawrence/object-detail/ObjectDetailFull";

export const dynamic = "force-dynamic";

export default function SupportTicketDetailPage({ params }: { params: { ticketId: string } }) {
  return <ObjectDetailFull objectType="SupportTicket" objectId={params.ticketId} />;
}
