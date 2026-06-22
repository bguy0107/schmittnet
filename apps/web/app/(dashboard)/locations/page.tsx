import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LocationsView } from "@/components/features/locations-view";

export default async function LocationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "OWNER" && session.user.role !== "OWNER_STAFF") redirect("/tickets");

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900 dark:text-gray-100">Locations</h1>
      <LocationsView />
    </div>
  );
}
