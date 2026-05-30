import { auth } from "@/auth";
import { TicketList } from "@/components/features/ticket-list";

export default async function TicketsPage() {
  const session = await auth();
  if (!session?.user) return null;

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Tickets</h1>
      <TicketList role={session.user.role} ownerId={session.user.ownerId} />
    </div>
  );
}
