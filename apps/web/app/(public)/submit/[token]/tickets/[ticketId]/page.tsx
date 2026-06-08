import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PublicTicketDetail } from "@/components/features/public-ticket-detail";

interface PageProps {
  params: Promise<{ token: string; ticketId: string }>;
}

export default async function PublicTicketDetailPage({ params }: PageProps) {
  const { token, ticketId } = await params;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 dark:bg-gray-950">
      <div className="mx-auto max-w-lg">
        <div className="mb-6">
          <Link
            href={`/submit/${token}/tickets`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to tickets
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-gray-900 dark:text-gray-100">Ticket Detail</h1>
        </div>
        <Suspense fallback={<div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">Loading…</div>}>
          <PublicTicketDetail token={token} ticketId={ticketId} />
        </Suspense>
      </div>
    </main>
  );
}
