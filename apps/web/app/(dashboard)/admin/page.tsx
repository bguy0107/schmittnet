import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminPanel } from "@/components/features/admin-panel";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) return null;

  if (session.user.role !== "SUPER_ADMIN") redirect("/tickets");

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900 dark:text-gray-100">Admin</h1>
      <AdminPanel />
    </div>
  );
}
