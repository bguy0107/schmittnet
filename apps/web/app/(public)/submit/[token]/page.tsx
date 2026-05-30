import { Suspense } from "react";
import { TicketSubmitForm } from "@/components/features/ticket-submit-form";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function SubmitPage({ params }: PageProps) {
  const { token } = await params;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Report an Issue</h1>
          <p className="mt-1 text-sm text-gray-500">
            Fill out the form below to submit a ticket.
          </p>
        </div>
        <Suspense fallback={<div className="text-center text-gray-500">Loading…</div>}>
          <TicketSubmitForm token={token} />
        </Suspense>
      </div>
    </main>
  );
}
