// Domain enums — kept in sync with Prisma schema enums

export type Role = "SUPER_ADMIN" | "OWNER" | "OWNER_STAFF" | "TECHNICIAN";

export type Category = "IT" | "MAINTENANCE";

export type TicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "AWAITING_APPROVAL"
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
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Ticket shapes

export interface TicketSummary {
  id: string;
  referenceCode: string;
  category: Category;
  status: TicketStatus;
  priority: Priority;
  description: string;
  locationName: string;
  assigneeName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketDetail extends TicketSummary {
  deadline: string | null;
  onHoldReason: string | null;
  resolvedAt: string | null;
  acknowledgedAt: string | null;
  notes: TicketNoteShape[];
  media: TicketMediaShape[];
  pendingApproval: TicketApprovalShape | null;
}

export interface TicketNoteShape {
  id: string;
  content: string;
  authorName: string;
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
  urgency: "NORMAL" | "SERVICE_IMPACTING";
  deadline?: string;
  mediaKeys: string[];
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
