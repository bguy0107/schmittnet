import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function RootPage() {
  const session = await auth();

  if (!session?.user) redirect("/login");

  switch (session.user.role) {
    case "SUPER_ADMIN":
      redirect("/admin");
    case "OWNER":
    case "OWNER_STAFF":
      redirect("/owner");
    default:
      redirect("/tickets");
  }
}
