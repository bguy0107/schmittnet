"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, QrCode } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { fetchApi } from "@/lib/api";

// ─── Users tab ───────────────────────────────────────────────────────────────

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  categories: string[];
}

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["SUPER_ADMIN", "OWNER", "OWNER_STAFF", "TECHNICIAN"]),
  password: z.string().min(12, "Password must be at least 12 characters"),
});
type CreateUserData = z.infer<typeof createUserSchema>;

function UsersTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchApi<UserRow[]>("/api/users"),
  });

  const createUser = useMutation({
    mutationFn: (body: CreateUserData) =>
      fetchApi("/api/users", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
      setShowForm(false);
      setFormError(null);
    },
    onError: (err) => setFormError(err instanceof Error ? err.message : "Failed to create user"),
  });

  const deactivateUser = useMutation({
    mutationFn: (id: string) =>
      fetchApi(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify({ isActive: false }) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateUserData>({
    resolver: zodResolver(createUserSchema),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {users ? `${users.length} users` : "Users"}
        </h2>
        <Button size="sm" onClick={() => { setShowForm((s) => !s); reset(); setFormError(null); }}>
          <Plus className="h-4 w-4" />
          Add user
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit((d) => createUser.mutate(d))}
          className="space-y-3 rounded-lg border bg-gray-50 p-4 dark:bg-gray-800"
        >
          {formError && <Alert variant="destructive"><AlertDescription>{formError}</AlertDescription></Alert>}
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
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={createUser.isPending}>
              {createUser.isPending ? "Creating…" : "Create"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {isLoading && <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading…</div>}

      {users && (
        <div className="overflow-hidden rounded-lg border bg-white dark:bg-gray-900">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{u.name}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{u.role.replace(/_/g, " ")}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={u.isActive ? "success" : "secondary"}>
                      {u.isActive ? "Active" : "Disabled"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.isActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm(`Deactivate ${u.name}?`)) deactivateUser.mutate(u.id);
                        }}
                      >
                        Deactivate
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

const createLocationSchema = z.object({
  name: z.string().min(2),
  ownerId: z.string().uuid("Enter a valid owner ID"),
  address: z.string().optional(),
});
type CreateLocationData = z.infer<typeof createLocationSchema>;

function LocationsTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: locations, isLoading } = useQuery({
    queryKey: ["admin-locations"],
    queryFn: () => fetchApi<LocationRow[]>("/api/locations"),
  });

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
        <Button size="sm" onClick={() => { setShowForm((s) => !s); reset(); setFormError(null); }}>
          <Plus className="h-4 w-4" />
          Add location
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit((d) => createLocation.mutate(d))}
          className="space-y-3 rounded-lg border bg-gray-50 p-4 dark:bg-gray-800"
        >
          {formError && <Alert variant="destructive"><AlertDescription>{formError}</AlertDescription></Alert>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="l-name">Location name</Label>
              <Input id="l-name" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="l-owner">Owner ID</Label>
              <Input id="l-owner" placeholder="UUID" {...register("ownerId")} />
              {errors.ownerId && <p className="text-xs text-destructive">{errors.ownerId.message}</p>}
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="l-address">Address <span className="text-gray-400">(optional)</span></Label>
              <Input id="l-address" {...register("address")} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={createLocation.isPending}>
              {createLocation.isPending ? "Creating…" : "Create"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {isLoading && <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading…</div>}

      {locations && (
        <div className="space-y-2">
          {locations.map((loc) => (
            <div key={loc.id} className="flex items-center justify-between rounded-lg border bg-white px-4 py-3 dark:bg-gray-900">
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">{loc.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{loc.owner.name}{loc.address ? ` · ${loc.address}` : ""}</p>
              </div>
              <div className="flex items-center gap-2">
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
    </div>
  );
}

// ─── Admin panel (tabbed) ─────────────────────────────────────────────────────

type Tab = "users" | "locations";

export function AdminPanel() {
  const [tab, setTab] = useState<Tab>("users");

  return (
    <div className="space-y-4">
      <div className="flex w-fit gap-1 rounded-lg border bg-white p-1 shadow-sm dark:bg-gray-900">
        {(["users", "locations"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t ? "bg-primary text-primary-foreground shadow-sm" : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "users" && <UsersTab />}
      {tab === "locations" && <LocationsTab />}
    </div>
  );
}
