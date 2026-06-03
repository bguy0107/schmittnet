import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { OwnerDashboard } from "@/components/features/owner-dashboard";

export default async function OwnerPage() {
  const session = await auth();
  if (!session?.user) return null;

  const { role } = session.user;
  if (role !== "OWNER" && role !== "OWNER_STAFF" && role !== "SUPER_ADMIN") {
    redirect("/tickets");
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900 dark:text-gray-100">Dashboard</h1>
      <OwnerDashboard ownerId={session.user.ownerId} />
    </div>
  );
}
