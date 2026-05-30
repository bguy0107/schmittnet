"use client";

import { AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboard } from "@/hooks/use-dashboard";

interface StatCardProps {
  label: string;
  value: number | string;
  accent?: string;
}

function StatCard({ label, value, accent }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-3xl font-bold ${accent ?? "text-gray-900 dark:text-gray-100"}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

export function OwnerDashboard({ ownerId }: { ownerId: string | null }) {
  void ownerId;
  const { data, isLoading, isError } = useDashboard();

  if (isLoading) {
    return <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">Loading dashboard…</div>;
  }

  if (isError || !data) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
        <AlertCircle className="h-4 w-4 shrink-0" />
        Failed to load dashboard. Please refresh.
      </div>
    );
  }

  const avgHours =
    data.avgResolutionHours !== null ? `${data.avgResolutionHours.toFixed(1)} h` : "—";

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Open" value={data.open} accent="text-blue-600" />
        <StatCard label="In Progress" value={data.inProgress} accent="text-yellow-600" />
        <StatCard label="Awaiting Approval" value={data.awaitingApproval} accent="text-red-600" />
        <StatCard label="Resolved" value={data.resolved} accent="text-green-600" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard label="Avg. Resolution Time" value={avgHours} />
      </div>

      {/* By location */}
      {data.ticketsByLocation.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tickets by location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.ticketsByLocation.map(({ locationName, count }) => {
              const max = data.ticketsByLocation[0]?.count ?? 1;
              const pct = Math.round((count / max) * 100);
              return (
                <div key={locationName}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium text-gray-700 dark:text-gray-200">{locationName}</span>
                    <span className="text-gray-500 dark:text-gray-400">{count}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${pct}%` }}
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${locationName}: ${count} tickets`}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
