import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { TechnicianDashboard } from "@/components/features/technician-dashboard";

export default async function TechnicianPage() {
  const session = await auth();
  if (!session?.user) return null;

  if (session.user.role !== "TECHNICIAN") redirect("/tickets");

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900 dark:text-gray-100">Dashboard</h1>
      <TechnicianDashboard />
    </div>
  );
}
