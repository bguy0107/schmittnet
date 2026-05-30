import type { TicketStatus, Priority } from "@schmittnet/types";

export function deriveReferenceCode(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function statusLabel(status: TicketStatus): string {
  const labels: Record<TicketStatus, string> = {
    OPEN: "Open",
    IN_PROGRESS: "In Progress",
    ON_HOLD: "On Hold",
    AWAITING_APPROVAL: "Awaiting Approval",
    RESOLVED: "Resolved",
    CANCELLED: "Cancelled",
  };
  return labels[status];
}

export function priorityLabel(priority: Priority): string {
  const labels: Record<Priority, string> = {
    P0: "Service-Impacting",
    P1: "High",
    P2: "Medium",
    NORMAL: "Normal",
  };
  return labels[priority];
}

export function isServiceImpacting(priority: Priority): boolean {
  return priority === "P0";
}

export function clsx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
