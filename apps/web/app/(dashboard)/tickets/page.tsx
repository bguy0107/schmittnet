import { auth } from "@/auth";
import { TicketList } from "@/components/features/ticket-list";

interface TicketsPageProps {
  searchParams: Promise<{ status?: string; category?: string; locationId?: string }>;
}

export default async function TicketsPage({ searchParams }: TicketsPageProps) {
  const [session, params] = await Promise.all([auth(), searchParams]);
  if (!session?.user) return null;

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900 dark:text-gray-100">Tickets</h1>
      <TicketList
        role={session.user.role}
        ownerId={session.user.ownerId}
        initialStatus={params.status ?? ""}
        initialCategory={params.category ?? ""}
        initialLocationId={params.locationId ?? ""}
      />
    </div>
  );
}
