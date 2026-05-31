import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { TicketDetail } from "@/components/features/ticket-detail";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  return (
    <div>
      <TicketDetail
        ticketId={id}
        userId={session.user.id}
        // @ts-expect-error — extended session field
        role={session.user.role}
      />
    </div>
  );
}
