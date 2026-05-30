import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardNav } from "@/components/features/dashboard-nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  // Service layer enforces this too; redirect here for UX only.
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <DashboardNav user={session.user} />
      <main className="flex-1 bg-gray-50 px-4 py-6 dark:bg-gray-950 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
