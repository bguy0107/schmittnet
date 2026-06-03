"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { fetchApi, ApiRequestError } from "@/lib/api";
import type { UserRow } from "@/src/repositories/user-repository";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  OWNER: "Owner",
  OWNER_STAFF: "Owner Staff",
  TECHNICIAN: "Technician",
};

const profileSchema = z.object({
  name: z.string().min(2, "At least 2 characters").max(100, "At most 100 characters"),
  notificationEmail: z.boolean(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

export function ProfileForm({ profile }: { profile: UserRow }) {
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: profile.name ?? "",
      notificationEmail: profile.notificationEmail,
    },
  });

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
  });

  async function onProfileSubmit(data: ProfileValues) {
    setProfileError(null);
    setProfileSuccess(false);
    try {
      await fetchApi("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name: data.name,
          notificationEmail: data.notificationEmail,
        }),
      });
      setProfileSuccess(true);
    } catch (err) {
      setProfileError(
        err instanceof ApiRequestError ? err.message : "An unexpected error occurred.",
      );
    }
  }

  async function onPasswordSubmit(data: PasswordValues) {
    setPasswordError(null);
    setPasswordSuccess(false);
    try {
      await fetchApi("/api/profile/password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      });
      passwordForm.reset();
      setPasswordSuccess(true);
    } catch (err) {
      setPasswordError(
        err instanceof ApiRequestError ? err.message : "An unexpected error occurred.",
      );
    }
  }

  return (
    <div className="space-y-6">
      {/* Account + notification preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={profileForm.handleSubmit(onProfileSubmit)}
            className="space-y-5"
            noValidate
          >
            {profileSuccess && (
              <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                <AlertDescription className="text-green-800 dark:text-green-200">
                  Profile saved.
                </AlertDescription>
              </Alert>
            )}
            {profileError && (
              <Alert variant="destructive">
                <AlertDescription>{profileError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="name">Display name</Label>
              <Input
                id="name"
                type="text"
                autoComplete="name"
                aria-invalid={!!profileForm.formState.errors.name}
                {...profileForm.register("name")}
              />
              {profileForm.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {profileForm.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                readOnly
                className="cursor-not-allowed bg-gray-50 dark:bg-gray-800"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed. Contact your administrator.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Role</Label>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{ROLE_LABELS[profile.role] ?? profile.role}</Badge>
                {profile.categories.map((cat) => (
                  <Badge key={cat} variant="outline">
                    {cat === "IT" ? "IT" : "Maintenance"}
                  </Badge>
                ))}
              </div>
            </div>

            <hr className="border-gray-200 dark:border-gray-700" />

            <div className="space-y-3">
              <Label className="text-sm font-medium">Notifications</Label>

              <div className="flex items-center gap-2">
                <input
                  id="notificationEmail"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 accent-primary"
                  {...profileForm.register("notificationEmail")}
                />
                <Label htmlFor="notificationEmail" className="cursor-pointer font-normal">
                  Email notifications
                </Label>
              </div>

            </div>

            <Button
              type="submit"
              disabled={profileForm.formState.isSubmitting}
              className="w-full sm:w-auto"
            >
              {profileForm.formState.isSubmitting ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password change */}
      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
            className="space-y-5"
            noValidate
          >
            {passwordSuccess && (
              <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                <AlertDescription className="text-green-800 dark:text-green-200">
                  Password changed.
                </AlertDescription>
              </Alert>
            )}
            {passwordError && (
              <Alert variant="destructive">
                <AlertDescription>{passwordError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                aria-invalid={!!passwordForm.formState.errors.currentPassword}
                {...passwordForm.register("currentPassword")}
              />
              {passwordForm.formState.errors.currentPassword && (
                <p className="text-xs text-destructive">
                  {passwordForm.formState.errors.currentPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                aria-invalid={!!passwordForm.formState.errors.newPassword}
                {...passwordForm.register("newPassword")}
              />
              {passwordForm.formState.errors.newPassword && (
                <p className="text-xs text-destructive">
                  {passwordForm.formState.errors.newPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                aria-invalid={!!passwordForm.formState.errors.confirmPassword}
                {...passwordForm.register("confirmPassword")}
              />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-xs text-destructive">
                  {passwordForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={passwordForm.formState.isSubmitting}
              className="w-full sm:w-auto"
            >
              {passwordForm.formState.isSubmitting ? "Changing…" : "Change password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
