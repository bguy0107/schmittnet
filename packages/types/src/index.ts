// Domain enums — kept in sync with Prisma schema enums

export type Role = "SUPER_ADMIN" | "OWNER" | "OWNER_STAFF" | "TECHNICIAN";

export type Category = "IT" | "MAINTENANCE";

export type TicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "AWAITING_APPROVAL"
  | "APPROVED"
  | "RESOLVED"
  | "CANCELLED";

export type Priority = "P0" | "P1" | "P2" | "NORMAL";

export type MediaType = "PHOTO" | "VIDEO";

export type ApprovalStatus = "PENDING" | "APPROVED" | "DECLINED";

// API response shapes

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginatedResponse<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Ticket shapes

export interface TicketSummary {
  id: string;
  category: Category;
  status: TicketStatus;
  priority: Priority;
  description: string;
  location: { id: string; name: string };
  assignee: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketDetail extends TicketSummary {
  deadline: string | null;
  onHoldReason: string | null;
  resolvedAt: string | null;
  acknowledgedAt: string | null;
  history: TicketHistoryEntryShape[];
  media: TicketMediaShape[];
  pendingApproval: TicketApprovalShape | null;
}

export type HistoryEntryType = "NOTE" | "STATUS_CHANGE" | "DEADLINE_CHANGE";

export interface TicketHistoryEntryShape {
  id: string;
  type: HistoryEntryType;
  content: string | null;
  fromStatus: TicketStatus | null;
  toStatus: TicketStatus | null;
  authorName: string | null;
  createdAt: string;
}

export interface TicketMediaShape {
  id: string;
  mediaType: MediaType;
  mimeType: string;
  url: string;
}

export interface TicketApprovalShape {
  id: string;
  status: ApprovalStatus;
  requesterName: string;
  notes: string | null;
  createdAt: string;
}

// Submission

export interface SubmitTicketInput {
  category: Category;
  description: string;
  deadline?: string;
  mediaKeys: string[];
  reporterName: string;
}

export interface SubmitTicketResponse {
  id: string;
  referenceCode: string;
}

// Location context returned for the public submit form

export interface LocationContext {
  id: string;
  name: string;
}

// Reporting dashboard

export interface DashboardStats {
  open: number;
  inProgress: number;
  awaitingApproval: number;
  resolved: number;
  avgResolutionHours: number | null;
  ticketsByLocation: Array<{ locationName: string; count: number }>;
}
