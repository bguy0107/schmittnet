import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { VideoRequestList } from "@/components/features/video-request-list";

interface PageProps {
  searchParams: Promise<{ status?: string; locationId?: string }>;
}

export default async function VideoRequestsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900 dark:text-gray-100">Video Requests</h1>
      <VideoRequestList
        initialStatus={params.status ?? ""}
        initialLocationId={params.locationId ?? ""}
      />
    </div>
  );
}
