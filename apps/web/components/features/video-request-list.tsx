"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Route } from "next";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useVideoRequests } from "@/hooks/use-video-requests";
import { OpenVideoRequestPanel } from "./open-video-request-panel";
import { fetchApi } from "@/lib/api";
import { formatDateTime } from "@schmittnet/utils";
import type { VideoRequestStatus, RequestingParty } from "@schmittnet/types";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "OPEN", label: "Open" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CANCELLED", label: "Cancelled" },
];

function statusVariant(status: VideoRequestStatus) {
  switch (status) {
    case "OPEN": return "destructive" as const;
    case "RESOLVED": return "success" as const;
    case "CANCELLED": return "secondary" as const;
  }
}

function statusLabel(status: VideoRequestStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function partyLabel(party: RequestingParty): string {
  return party === "LAW_ENFORCEMENT" ? "Law Enforcement" : "Internal";
}

const PAGE_SIZE = 25;

interface VideoRequestListProps {
  initialStatus?: string;
  initialLocationId?: string;
}

export function VideoRequestList({ initialStatus = "", initialLocationId = "" }: VideoRequestListProps) {
  const [status, setStatus] = useState(initialStatus);
  const [locationId, setLocationId] = useState(initialLocationId);
  const [page, setPage] = useState(1);
  const [showPanel, setShowPanel] = useState(false);

  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: () => fetchApi<{ id: string; name: string }[]>("/api/locations"),
  });

  const { data, isLoading, isError } = useVideoRequests({ status, locationId, page, pageSize: PAGE_SIZE });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <div className="space-y-4">
      {/* Filter bar + action */}
      <div className="flex items-start gap-2">
        <div className="flex flex-1 flex-wrap gap-2">
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Filter by status"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <Button size="sm" className="shrink-0" onClick={() => setShowPanel(true)}>
          <Plus className="h-4 w-4" />
          New Request
        </Button>
      </div>

      {isLoading && (
        <p className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      )}

      {isError && (
        <p className="py-12 text-center text-sm text-destructive">Failed to load video requests.</p>
      )}

      {data && data.rows.length === 0 && (
        <p className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">No video requests found.</p>
      )}

      {data && data.rows.length > 0 && (
        <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
          {data.rows.map((req) => (
            <Link
              key={req.id}
              href={`/video-requests/${req.id}` as Route}
              className="flex flex-col gap-1.5 px-4 py-3.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant(req.status)}>{statusLabel(req.status)}</Badge>
                  <Badge variant="secondary">{partyLabel(req.requestingParty)}</Badge>
                </div>
                <span className="shrink-0 font-mono text-xs text-gray-400 dark:text-gray-500">
                  #{req.id.slice(0, 8).toUpperCase()}
                </span>
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{req.location.name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">{req.cameraAreas}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {formatDateTime(req.createdAt)} · {req.submitterName}
              </p>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {data.total} request{data.total !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-600 dark:text-gray-300">{page} / {totalPages}</span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {showPanel && (
        <OpenVideoRequestPanel
          locations={locations ?? []}
          onClose={() => setShowPanel(false)}
        />
      )}
    </div>
  );
}
