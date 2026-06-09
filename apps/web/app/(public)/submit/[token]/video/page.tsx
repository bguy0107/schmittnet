import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { VideoRequestSubmitForm } from "@/components/features/video-request-submit-form";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function SubmitVideoRequestPage({ params }: PageProps) {
  const { token } = await params;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 dark:bg-gray-950">
      <div className="mx-auto max-w-lg">
        <div className="mb-6">
          <Link
            href={`/submit/${token}`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-gray-900 dark:text-gray-100">Request Video Footage</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Submit a request for security camera footage from this location.</p>
        </div>
        <VideoRequestSubmitForm token={token} />
      </div>
    </main>
  );
}
