"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AlertCircle, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTickets } from "@/hooks/use-tickets";
import { fetchApi } from "@/lib/api";
import { OpenTicketPanel } from "./open-ticket-panel";
import { formatDateTime } from "@schmittnet/utils";
import type { Role, TicketStatus, Category } from "@schmittnet/types";

interface TicketListProps {
  role: Role;
  ownerId: string | null;
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "ON_HOLD", label: "On Hold" },
  { value: "AWAITING_APPROVAL", label: "Awaiting Approval" },
  { value: "APPROVED", label: "Approved" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CANCELLED", label: "Cancelled" },
];

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All categories" },
  { value: "IT", label: "IT" },
  { value: "MAINTENANCE", label: "Maintenance" },
];

function statusVariant(status: TicketStatus) {
  switch (status) {
    case "OPEN": return "info" as const;
    case "IN_PROGRESS": return "warning" as const;
    case "AWAITING_APPROVAL": return "destructive" as const;
    case "APPROVED": return "success" as const;
    case "RESOLVED": return "success" as const;
    default: return "secondary" as const;
  }
}

function statusLabel(status: TicketStatus): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const PAGE_SIZE = 25;

export function TicketList({ role }: TicketListProps) {
  void role;
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [locationId, setLocationId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showOpenPanel, setShowOpenPanel] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: () => fetchApi<{ id: string; name: string }[]>("/api/locations"),
  });

  const { data, isLoading, isError } = useTickets({
    status: status || undefined,
    category: (category as Category) || undefined,
    locationId: locationId || undefined,
    search: search || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <div className="space-y-4">
      {/* Filter bar + action */}
      <div className="flex items-start gap-2">
        <div className="flex flex-1 flex-wrap gap-2">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Filter by category"
        >
          {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={locationId}
          onChange={(e) => { setLocationId(e.target.value); setPage(1); }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Filter by location"
        >
          <option value="">All locations</option>
          {locations?.map((loc) => (
            <option key={loc.id} value={loc.id}>{loc.name}</option>
          ))}
        </select>
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search tickets…"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Search tickets"
        />
        </div>
        <Button size="sm" className="shrink-0" onClick={() => setShowOpenPanel(true)}>
          <Plus className="h-4 w-4" />
          Open Ticket
        </Button>
      </div>

      {/* List */}
      {isLoading && (
        <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">Loading tickets…</div>
      )}

      {isError && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load tickets. Please refresh.
        </div>
      )}

      {data && data.rows.length === 0 && (
        <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">No tickets found.</div>
      )}

      {data && data.rows.length > 0 && (
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-gray-900">
          <ul className="divide-y">
            {data.rows.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/tickets/${ticket.id}`}
                  className="flex items-start justify-between gap-3 px-4 py-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {ticket.priority === "P0" && (
                        <span className="text-base" aria-label="Service-impacting">🚨</span>
                      )}
                      <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
                        #{ticket.id.slice(0, 8).toUpperCase()}
                      </span>
                      <Badge variant={statusVariant(ticket.status)}>
                        {statusLabel(ticket.status)}
                      </Badge>
                      <Badge variant="outline">{ticket.category}</Badge>
                    </div>
                    <p className="line-clamp-2 text-sm text-gray-700 dark:text-gray-200">{ticket.description}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {ticket.location.name}
                      {ticket.assignee ? ` · ${ticket.assignee.name}` : ""}
                      {" · "}
                      {formatDateTime(ticket.createdAt)}
                    </p>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pagination */}
      {data && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.total)} of {data.total}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage((p) => p + 1)}
              disabled={page === totalPages}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {showOpenPanel && (
        <OpenTicketPanel
          locations={locations ?? []}
          onClose={() => setShowOpenPanel(false)}
        />
      )}
    </div>
  );
}
