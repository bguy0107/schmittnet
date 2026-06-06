"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTechnicianDashboard } from "@/hooks/use-dashboard";

type Preset = "all" | "7d" | "30d" | "90d";

function getDateRange(preset: Preset): { from?: string; to?: string } {
  if (preset === "all") return {};
  const to = new Date();
  const from = new Date();
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  from.setDate(to.getDate() - days);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

const PRESETS: { label: string; value: Preset }[] = [
  { label: "All time", value: "all" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" },
];

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

export function TechnicianDashboard() {
  const [preset, setPreset] = useState<Preset>("30d");
  const { from, to } = getDateRange(preset);
  const { data, isLoading, isError } = useTechnicianDashboard(from, to);

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
      {/* Date range filter */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(({ label, value }) => (
          <Button
            key={value}
            variant={preset === value ? "default" : "outline"}
            size="sm"
            onClick={() => setPreset(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Open" value={data.open} accent="text-blue-600" />
        <StatCard label="In Progress" value={data.inProgress} accent="text-yellow-600" />
        <StatCard label="On Hold" value={data.onHold} accent="text-orange-600" />
        <StatCard label="Awaiting Approval" value={data.awaitingApproval} accent="text-red-600" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Resolved" value={data.resolved} accent="text-green-600" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard label="Avg. Resolution Time" value={avgHours} />
      </div>

      {/* By category */}
      {data.ticketsByCategory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tickets by category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.ticketsByCategory.map(({ category, count }) => {
              const max = Math.max(...data.ticketsByCategory.map((c) => c.count), 1);
              const pct = Math.round((count / max) * 100);
              return (
                <div key={category}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium text-gray-700 dark:text-gray-200">{category}</span>
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
                      aria-label={`${category}: ${count} tickets`}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

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
