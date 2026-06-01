"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";

interface PublicTicket {
  id: string;
  referenceCode: string;
  category: "IT" | "MAINTENANCE";
  status: string;
  description: string;
  createdAt: string;
}

interface PublicTicketsResponse {
  locationName: string;
  tickets: PublicTicket[];
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  ON_HOLD: "On Hold",
  AWAITING_APPROVAL: "Awaiting Approval",
  RESOLVED: "Resolved",
};

const STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  OPEN: "info",
  IN_PROGRESS: "warning",
  ON_HOLD: "warning",
  AWAITING_APPROVAL: "warning",
  RESOLVED: "success",
};

function relativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function PublicTicketList({ token }: { token: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-tickets", token],
    queryFn: () =>
      fetchApi<PublicTicketsResponse>(`/api/tickets/submit/${token}/public-tickets`),
    staleTime: 30_000,
  });

  if (isLoading) {
    return <div className="py-12 text-center text-sm text-gray-500">Loading…</div>;
  }

  if (isError || !data) {
    return (
      <div className="py-12 text-center text-sm text-gray-500">
        Unable to load tickets. This QR code may no longer be active.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700">
        📍 {data.locationName}
      </div>

      {data.tickets.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-500">
          No active tickets for this location.
        </div>
      ) : (
        data.tickets.map((ticket) => (
          <Link
            key={ticket.id}
            href={`/submit/${token}/tickets/${ticket.id}`}
            className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white p-4 shadow-sm transition-colors hover:border-primary"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-medium text-gray-400">
                  #{ticket.referenceCode}
                </span>
                <Badge variant={STATUS_VARIANT[ticket.status] ?? "outline"}>
                  {STATUS_LABELS[ticket.status] ?? ticket.status}
                </Badge>
              </div>
              <p className="mt-1.5 line-clamp-2 text-sm text-gray-800">{ticket.description}</p>
              <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-400">
                <span>{ticket.category === "IT" ? "🖥️ IT" : "🔧 Maintenance"}</span>
                <span>{relativeTime(ticket.createdAt)}</span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" aria-hidden="true" />
          </Link>
        ))
      )}
    </div>
  );
}
