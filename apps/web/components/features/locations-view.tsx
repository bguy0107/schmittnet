"use client";

import Link from "next/link";
import type { Route } from "next";
import { QrCode } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/api";

interface LocationRow {
  id: string;
  name: string;
  locationNumber: number | null;
  address: string | null;
  qrActive: boolean;
}

export function LocationsView() {
  const { data: locations, isLoading, isError } = useQuery({
    queryKey: ["locations"],
    queryFn: () => fetchApi<LocationRow[]>("/api/locations"),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
        {locations ? `${locations.length} locations` : "Locations"}
      </h2>

      {isLoading && (
        <p className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      )}

      {isError && (
        <p className="py-12 text-center text-sm text-destructive">Failed to load locations.</p>
      )}

      {locations && locations.length === 0 && (
        <p className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
          No locations found.
        </p>
      )}

      {locations && locations.length > 0 && (
        <div className="space-y-2">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className="flex items-center justify-between rounded-lg border bg-white px-4 py-3 dark:bg-gray-900"
            >
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {loc.locationNumber != null && (
                    <span className="mr-2 text-gray-400 dark:text-gray-500">#{loc.locationNumber}</span>
                  )}
                  {loc.name}
                </p>
                {loc.address && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">{loc.address}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={loc.qrActive ? "success" : "secondary"}>
                  {loc.qrActive ? "QR active" : "QR inactive"}
                </Badge>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/locations/${loc.id}/qr` as Route}>
                    <QrCode className="h-4 w-4" />
                    View QR
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
