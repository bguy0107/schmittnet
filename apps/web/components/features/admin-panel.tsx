"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, QrCode, Trash2 } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { fetchApi } from "@/lib/api";
import { useDiscordSettings, useUpdateDiscordSetting } from "@/hooks/use-tickets";

// ─── Users tab ───────────────────────────────────────────────────────────────

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  categories: string[];
  ownerId: string | null;
  notificationEmail: boolean;
}

const editUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  role: z.enum(["SUPER_ADMIN", "OWNER", "OWNER_STAFF", "TECHNICIAN"]),
  ownerId: z.string().optional(),
  notificationEmail: z.boolean(),
  password: z.string().min(8, "Must be at least 8 characters").or(z.literal("")).optional(),
});
type EditUserData = z.infer<typeof editUserSchema>;

function EditUserPanel({
  user,
  owners,
  onClose,
}: {
  user: UserRow;
  owners: UserRow[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [editError, setEditError] = useState<string | null>(null);
  const [editCategories, setEditCategories] = useState<string[]>(user.categories);

  const updateUser = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetchApi(`/api/users/${user.id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
      onClose();
    },
    onError: (err) => setEditError(err instanceof Error ? err.message : "Failed to update user"),
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<EditUserData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      name: user.name ?? "",
      role: user.role as EditUserData["role"],
      ownerId: user.ownerId ?? "",
      notificationEmail: user.notificationEmail,
      password: "",
    },
  });

  const watchedRole = watch("role");
  const showCategories = watchedRole === "TECHNICIAN";
  const showOwnerScope = watchedRole === "TECHNICIAN" || watchedRole === "OWNER_STAFF";

  function onSubmit(data: EditUserData) {
    const payload: Record<string, unknown> = {
      name: data.name,
      role: data.role,
      notificationEmail: data.notificationEmail,
      ownerId: showOwnerScope ? (data.ownerId || null) : null,
      categories: showCategories ? editCategories : [],
    };
    if (data.password) payload.password = data.password;
    updateUser.mutate(payload);
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto bg-white shadow-xl dark:bg-gray-900">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Edit user</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 text-lg leading-none">
            ✕
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 space-y-4 p-4">
          {editError && (
            <Alert variant="destructive">
              <AlertDescription>{editError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1">
            <Label className="text-xs text-gray-500 dark:text-gray-400">Email</Label>
            <p className="text-sm text-gray-900 dark:text-gray-100">{user.email}</p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="e-name">Name</Label>
            <Input id="e-name" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="e-role">Role</Label>
            <select
              id="e-role"
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring dark:bg-gray-900"
              {...register("role")}
            >
              <option value="TECHNICIAN">Technician</option>
              <option value="OWNER">Owner</option>
              <option value="OWNER_STAFF">Owner Staff</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
          </div>

          {showCategories && (
            <div className="space-y-2">
              <Label>Ticket categories</Label>
              <div className="flex gap-4">
                {(["IT", "MAINTENANCE"] as const).map((cat) => (
                  <label key={cat} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 accent-primary"
                      checked={editCategories.includes(cat)}
                      onChange={() =>
                        setEditCategories((prev) =>
                          prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
                        )
                      }
                    />
                    {cat === "IT" ? "IT" : "Maintenance"}
                  </label>
                ))}
              </div>
            </div>
          )}

          {showOwnerScope && (
            <div className="space-y-1">
              <Label htmlFor="e-owner">
                Owner scope{" "}
                <span className="text-gray-400 dark:text-gray-500">(optional)</span>
              </Label>
              <select
                id="e-owner"
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring dark:bg-gray-900"
                {...register("ownerId")}
              >
                <option value="">— All owners —</option>
                {owners.filter((o) => o.ownerId).map((o) => (
                  <option key={o.id} value={o.ownerId!}>
                    {o.name ?? o.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 accent-primary"
              {...register("notificationEmail")}
            />
            Email notifications
          </label>

          <div className="space-y-1">
            <Label htmlFor="e-password">New password</Label>
            <Input
              id="e-password"
              type="password"
              placeholder="Leave blank to keep current"
              {...register("password")}
            />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" size="sm" disabled={updateUser.isPending}>
              {updateUser.isPending ? "Saving…" : "Save changes"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["SUPER_ADMIN", "OWNER", "OWNER_STAFF", "TECHNICIAN"]),
  password: z.string().min(12, "Password must be at least 12 characters"),
  ownerId: z.string().optional(),
});
type CreateUserData = z.infer<typeof createUserSchema>;

function UsersTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [userView, setUserView] = useState<"active" | "deactivated">("active");

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchApi<UserRow[]>("/api/users"),
  });

  const owners = users?.filter((u) => u.role === "OWNER" && u.isActive) ?? [];

  const createUser = useMutation({
    mutationFn: (body: CreateUserData & { categories?: string[] }) =>
      fetchApi("/api/users", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
      setShowForm(false);
      setFormError(null);
      setSelectedCategories([]);
    },
    onError: (err) => setFormError(err instanceof Error ? err.message : "Failed to create user"),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetchApi(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => fetchApi(`/api/users/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<CreateUserData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: "TECHNICIAN" },
  });

  const watchedRole = useWatch({ control, name: "role" });
  const showCategories = watchedRole === "TECHNICIAN";
  const showOwnerScope = watchedRole === "TECHNICIAN" || watchedRole === "OWNER_STAFF";

  function handleCategoryToggle(cat: string) {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  }

  function onSubmit(data: CreateUserData) {
    const payload = {
      ...data,
      ownerId: data.ownerId || undefined,
      categories: showCategories && selectedCategories.length > 0 ? selectedCategories : undefined,
    };
    createUser.mutate(payload);
  }

  const activeUsers = users?.filter((u) => u.isActive) ?? [];
  const deactivatedUsers = users?.filter((u) => !u.isActive) ?? [];
  const visibleUsers = userView === "active" ? activeUsers : deactivatedUsers;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {users ? `${visibleUsers.length} users` : "Users"}
          </h2>
          <div className="flex gap-1 rounded-md border bg-gray-50 p-0.5 dark:bg-gray-800">
            <button
              onClick={() => setUserView("active")}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                userView === "active"
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              Active{users ? ` (${activeUsers.length})` : ""}
            </button>
            <button
              onClick={() => { setUserView("deactivated"); setShowForm(false); }}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                userView === "deactivated"
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              Deactivated{users ? ` (${deactivatedUsers.length})` : ""}
            </button>
          </div>
        </div>
        {userView === "active" && (
          <Button
            size="sm"
            onClick={() => {
              setShowForm((s) => !s);
              reset({ role: "TECHNICIAN" });
              setFormError(null);
              setSelectedCategories([]);
            }}
          >
            <Plus className="h-4 w-4" />
            Add user
          </Button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-3 rounded-lg border bg-gray-50 p-4 dark:bg-gray-800"
        >
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="u-name">Name</Label>
              <Input id="u-name" placeholder="Full name" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="u-email">Email</Label>
              <Input id="u-email" type="email" placeholder="user@example.com" {...register("email")} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="u-role">Role</Label>
              <select
                id="u-role"
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                {...register("role")}
              >
                <option value="TECHNICIAN">Technician</option>
                <option value="OWNER">Owner</option>
                <option value="OWNER_STAFF">Owner Staff</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="u-password">Password</Label>
              <Input id="u-password" type="password" placeholder="Min 12 chars" {...register("password")} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            {showCategories && (
              <div className="space-y-2 sm:col-span-2">
                <Label>Ticket categories</Label>
                <div className="flex gap-4">
                  {(["IT", "MAINTENANCE"] as const).map((cat) => (
                    <label key={cat} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 accent-primary"
                        checked={selectedCategories.includes(cat)}
                        onChange={() => handleCategoryToggle(cat)}
                      />
                      {cat === "IT" ? "IT" : "Maintenance"}
                    </label>
                  ))}
                </div>
                {showCategories && selectedCategories.length === 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Select at least one category so the technician receives ticket notifications.
                  </p>
                )}
              </div>
            )}

            {showOwnerScope && (
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="u-owner">
                  Owner scope{" "}
                  <span className="text-gray-400 dark:text-gray-500">(optional — leave blank for all locations)</span>
                </Label>
                <select
                  id="u-owner"
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  {...register("ownerId")}
                >
                  <option value="">— All owners —</option>
                  {owners.filter((o) => o.ownerId).map((o) => (
                    <option key={o.id} value={o.ownerId!}>
                      {o.name ?? o.email}
                    </option>
                  ))}
                </select>
                {owners.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">No active owners found.</p>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={createUser.isPending}>
              {createUser.isPending ? "Creating…" : "Create"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setShowForm(false);
                setSelectedCategories([]);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {isLoading && (
        <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading…</div>
      )}

      {users && (
        <div className="overflow-hidden rounded-lg border bg-white dark:bg-gray-900">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Categories</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibleUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                    {userView === "active" ? "No active users." : "No deactivated users."}
                  </td>
                </tr>
              )}
              {visibleUsers.map((u) => (
                <tr
                  key={u.id}
                  className={`${userView === "active" ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800" : "opacity-60"}`}
                  onClick={() => userView === "active" && setEditingUser(u)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{u.name}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{u.role.replace(/_/g, " ")}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {u.categories.length > 0 ? u.categories.join(", ") : <span className="text-gray-300 dark:text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {userView === "active" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm(`Deactivate ${u.name}?`)) {
                            toggleActive.mutate({ id: u.id, isActive: false });
                          }
                        }}
                      >
                        Deactivate
                      </Button>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                          onClick={() => toggleActive.mutate({ id: u.id, isActive: true })}
                        >
                          Reactivate
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={deleteUser.isPending}
                          onClick={() => {
                            if (confirm(`Permanently delete ${u.name ?? u.email}? This cannot be undone. Users with associated tickets or records cannot be deleted.`)) {
                              deleteUser.mutate(u.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingUser && (
        <EditUserPanel
          user={editingUser}
          owners={owners}
          onClose={() => setEditingUser(null)}
        />
      )}
    </div>
  );
}

// ─── Locations tab ────────────────────────────────────────────────────────────

interface LocationRow {
  id: string;
  name: string;
  address: string | null;
  qrActive: boolean;
  qrToken: string;
  owner: { name: string };
}

const editLocationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  address: z.string().max(200).optional(),
  qrActive: z.boolean(),
});
type EditLocationData = z.infer<typeof editLocationSchema>;

function EditLocationPanel({
  location,
  onClose,
}: {
  location: LocationRow;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [editError, setEditError] = useState<string | null>(null);

  const deleteLocation = useMutation({
    mutationFn: () => fetchApi(`/api/locations/${location.id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-locations"] });
      onClose();
    },
    onError: (err) => setEditError(err instanceof Error ? err.message : "Failed to delete location"),
  });

  const updateLocation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetchApi(`/api/locations/${location.id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-locations"] });
      onClose();
    },
    onError: (err) => setEditError(err instanceof Error ? err.message : "Failed to update location"),
  });

  const regenerateToken = useMutation({
    mutationFn: () =>
      fetchApi(`/api/locations/${location.id}`, {
        method: "PATCH",
        body: JSON.stringify({ regenerateToken: true }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-locations"] });
      onClose();
    },
    onError: (err) => setEditError(err instanceof Error ? err.message : "Failed to regenerate token"),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditLocationData>({
    resolver: zodResolver(editLocationSchema),
    defaultValues: {
      name: location.name,
      address: location.address ?? "",
      qrActive: location.qrActive,
    },
  });

  function onSubmit(data: EditLocationData) {
    updateLocation.mutate({
      name: data.name,
      address: data.address || undefined,
      qrActive: data.qrActive,
    });
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto bg-white shadow-xl dark:bg-gray-900">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Edit location</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 text-lg leading-none">
            ✕
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 space-y-4 p-4">
          {editError && (
            <Alert variant="destructive">
              <AlertDescription>{editError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1">
            <Label className="text-xs text-gray-500 dark:text-gray-400">Owner</Label>
            <p className="text-sm text-gray-900 dark:text-gray-100">{location.owner.name}</p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="el-name">Location name</Label>
            <Input id="el-name" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="el-address">
              Address <span className="text-gray-400 dark:text-gray-500">(optional)</span>
            </Label>
            <Input id="el-address" {...register("address")} />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 accent-primary"
              {...register("qrActive")}
            />
            QR code active
          </label>

          <div className="flex gap-2 pt-2">
            <Button type="submit" size="sm" disabled={updateLocation.isPending}>
              {updateLocation.isPending ? "Saving…" : "Save changes"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>

          <div className="border-t pt-4">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              disabled={regenerateToken.isPending}
              onClick={() => {
                if (confirm("Regenerate QR token? The current QR code will stop working.")) {
                  regenerateToken.mutate();
                }
              }}
            >
              {regenerateToken.isPending ? "Regenerating…" : "Regenerate QR token"}
            </Button>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Invalidates the existing QR code immediately.
            </p>
          </div>

          <div className="border-t pt-4">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={deleteLocation.isPending}
              onClick={() => {
                if (
                  confirm(
                    `Permanently delete "${location.name}"? This will also delete all tickets and associated records for this location. This cannot be undone.`,
                  )
                ) {
                  deleteLocation.mutate();
                }
              }}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              {deleteLocation.isPending ? "Deleting…" : "Delete location"}
            </Button>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Permanently removes this location and all its tickets.
            </p>
          </div>
        </form>
      </div>
    </>
  );
}

const createLocationSchema = z.object({
  name: z.string().min(2),
  ownerId: z.string().uuid("Select an owner"),
  address: z.string().optional(),
});
type CreateLocationData = z.infer<typeof createLocationSchema>;

function LocationsTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingLocation, setEditingLocation] = useState<LocationRow | null>(null);

  const { data: locations, isLoading } = useQuery({
    queryKey: ["admin-locations"],
    queryFn: () => fetchApi<LocationRow[]>("/api/locations"),
  });

  const { data: allUsers } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchApi<UserRow[]>("/api/users"),
  });

  const owners = allUsers?.filter((u) => u.role === "OWNER" && u.isActive) ?? [];

  const createLocation = useMutation({
    mutationFn: (body: CreateLocationData) =>
      fetchApi("/api/locations", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-locations"] });
      setShowForm(false);
      setFormError(null);
    },
    onError: (err) => setFormError(err instanceof Error ? err.message : "Failed to create location"),
  });

  const regenerateToken = useMutation({
    mutationFn: (id: string) =>
      fetchApi(`/api/locations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ regenerateToken: true }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-locations"] }),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateLocationData>({
    resolver: zodResolver(createLocationSchema),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {locations ? `${locations.length} locations` : "Locations"}
        </h2>
        <Button
          size="sm"
          onClick={() => {
            setShowForm((s) => !s);
            reset();
            setFormError(null);
          }}
        >
          <Plus className="h-4 w-4" />
          Add location
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit((d) => createLocation.mutate(d))}
          className="space-y-3 rounded-lg border bg-gray-50 p-4 dark:bg-gray-800"
        >
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="l-name">Location name</Label>
              <Input id="l-name" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="l-owner">Owner</Label>
              <select
                id="l-owner"
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                {...register("ownerId")}
              >
                <option value="">— Select owner —</option>
                {owners.filter((o) => o.ownerId).map((o) => (
                  <option key={o.id} value={o.ownerId!}>
                    {o.name ?? o.email}
                  </option>
                ))}
              </select>
              {errors.ownerId && <p className="text-xs text-destructive">{errors.ownerId.message}</p>}
              {owners.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  No active owners found. Create an Owner user first.
                </p>
              )}
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="l-address">
                Address <span className="text-gray-400">(optional)</span>
              </Label>
              <Input id="l-address" {...register("address")} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={createLocation.isPending}>
              {createLocation.isPending ? "Creating…" : "Create"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {isLoading && (
        <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading…</div>
      )}

      {locations && (
        <div className="space-y-2">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className="flex cursor-pointer items-center justify-between rounded-lg border bg-white px-4 py-3 hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800"
              onClick={() => setEditingLocation(loc)}
            >
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">{loc.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {loc.owner.name}
                  {loc.address ? ` · ${loc.address}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Badge variant={loc.qrActive ? "success" : "secondary"}>
                  {loc.qrActive ? "QR active" : "QR inactive"}
                </Badge>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/locations/${loc.id}/qr`}>
                    <QrCode className="h-4 w-4" />
                    Print QR
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm("Regenerate QR token? The current QR code will stop working.")) {
                      regenerateToken.mutate(loc.id);
                    }
                  }}
                >
                  Regen QR
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingLocation && (
        <EditLocationPanel
          location={editingLocation}
          onClose={() => setEditingLocation(null)}
        />
      )}
    </div>
  );
}

// ─── Discord settings tab ─────────────────────────────────────────────────────

type DiscordSavedKey = "IT_webhook" | "MAINTENANCE_webhook" | "IT_role" | "MAINTENANCE_role";

function DiscordSettingsTab() {
  const { data: settings, isLoading } = useDiscordSettings();
  const update = useUpdateDiscordSetting();
  const [webhooks, setWebhooks] = useState({ IT: "", MAINTENANCE: "" });
  const [roles, setRoles] = useState({ IT: "", MAINTENANCE: "" });
  const [saved, setSaved] = useState<DiscordSavedKey | null>(null);

  useEffect(() => {
    if (settings) {
      setWebhooks({ IT: settings.IT ?? "", MAINTENANCE: settings.MAINTENANCE ?? "" });
      setRoles({ IT: settings.ROLE_IT ?? "", MAINTENANCE: settings.ROLE_MAINTENANCE ?? "" });
    }
  }, [settings]);

  function handleSaveWebhook(category: "IT" | "MAINTENANCE") {
    const key: DiscordSavedKey = `${category}_webhook`;
    update.mutate(
      { category, webhookUrl: webhooks[category] },
      { onSuccess: () => { setSaved(key); setTimeout(() => setSaved(null), 2000); } },
    );
  }

  function handleSaveRole(category: "IT" | "MAINTENANCE") {
    const key: DiscordSavedKey = `${category}_role`;
    update.mutate(
      { category, roleId: roles[category] },
      { onSuccess: () => { setSaved(key); setTimeout(() => setSaved(null), 2000); } },
    );
  }

  if (isLoading) {
    return <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Discord channel webhooks that receive notifications when a ticket is opened or moves to
        in progress. Leave blank to disable.
      </p>

      {(["IT", "MAINTENANCE"] as const).map((cat) => (
        <div key={cat} className="space-y-3">
          <p className="text-sm font-medium">{cat === "IT" ? "IT" : "Maintenance"}</p>

          <div className="space-y-1">
            <Label htmlFor={`discord-${cat}`}>Webhook URL</Label>
            <div className="flex gap-2">
              <Input
                id={`discord-${cat}`}
                placeholder="https://discord.com/api/webhooks/…"
                value={webhooks[cat]}
                onChange={(e) => setWebhooks((v) => ({ ...v, [cat]: e.target.value }))}
                className="flex-1"
              />
              <Button
                size="sm"
                disabled={update.isPending}
                onClick={() => handleSaveWebhook(cat)}
              >
                {saved === `${cat}_webhook` ? "Saved!" : "Save"}
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor={`discord-role-${cat}`}>Role ID to ping</Label>
            <div className="flex gap-2">
              <Input
                id={`discord-role-${cat}`}
                placeholder="e.g. 1234567890123456789"
                value={roles[cat]}
                onChange={(e) => setRoles((v) => ({ ...v, [cat]: e.target.value }))}
                className="flex-1"
              />
              <Button
                size="sm"
                disabled={update.isPending}
                onClick={() => handleSaveRole(cat)}
              >
                {saved === `${cat}_role` ? "Saved!" : "Save"}
              </Button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Right-click a role in Discord → Copy Role ID. Leave blank to disable pinging.
            </p>
          </div>

          {update.isError && (
            <p className="text-xs text-destructive">Failed to save — check the values and try again.</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Admin panel (tabbed) ─────────────────────────────────────────────────────

type Tab = "users" | "locations" | "settings";

export function AdminPanel() {
  const [tab, setTab] = useState<Tab>("users");

  return (
    <div className="space-y-4">
      <div className="flex w-fit gap-1 rounded-lg border bg-white p-1 shadow-sm dark:bg-gray-900">
        {(["users", "locations", "settings"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "users" && <UsersTab />}
      {tab === "locations" && <LocationsTab />}
      {tab === "settings" && <DiscordSettingsTab />}
    </div>
  );
}
