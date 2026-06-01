import Link from "next/link";
import { ClipboardPlus, List } from "lucide-react";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function SubmitLandingPage({ params }: PageProps) {
  const { token } = await params;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-sm space-y-4">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">What would you like to do?</h1>
        </div>

        <Link
          href={`/submit/${token}/new`}
          className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-primary hover:shadow-md"
        >
          <ClipboardPlus className="h-8 w-8 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="font-semibold text-gray-900">Open a Ticket</p>
            <p className="text-sm text-gray-500">Report a new IT or maintenance issue</p>
          </div>
        </Link>

        <Link
          href={`/submit/${token}/tickets`}
          className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-primary hover:shadow-md"
        >
          <List className="h-8 w-8 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="font-semibold text-gray-900">View Tickets</p>
            <p className="text-sm text-gray-500">See open and recent tickets for this location</p>
          </div>
        </Link>
      </div>
    </main>
  );
}
