import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { profileService } from "@/src/services/profile-service";
import { ProfileForm } from "@/components/features/profile-form";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const profile = await profileService.getProfile(session.user.id);
  if (!profile) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Profile</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage your account settings and notification preferences.
        </p>
      </div>
      <ProfileForm profile={profile} />
    </div>
  );
}
