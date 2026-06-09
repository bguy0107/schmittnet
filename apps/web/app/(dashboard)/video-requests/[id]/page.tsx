import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { VideoRequestDetail } from "@/components/features/video-request-detail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function VideoRequestDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  return (
    <div>
      <VideoRequestDetail requestId={id} role={session.user.role} />
    </div>
  );
}
