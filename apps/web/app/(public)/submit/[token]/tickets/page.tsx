import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PublicTicketList } from "@/components/features/public-ticket-list";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PublicTicketsPage({ params }: PageProps) {
  const { token } = await params;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-lg">
        <div className="mb-6">
          <Link
            href={`/submit/${token}`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">Tickets</h1>
          <p className="mt-1 text-sm text-gray-500">Active and recent tickets for this location.</p>
        </div>
        <Suspense fallback={<div className="py-12 text-center text-sm text-gray-500">Loading…</div>}>
          <PublicTicketList token={token} />
        </Suspense>
      </div>
    </main>
  );
}
