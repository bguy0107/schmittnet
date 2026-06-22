import { Queue, type ConnectionOptions } from "bullmq";
import { redis } from "@/src/lib/redis";
import { logger } from "@/src/lib/logger";
import type { Category } from "@schmittnet/types";

export type NotificationJobData =
  | { type: "TICKET_OPENED"; ticketId: string; locationId: string; category: Category }
  | { type: "TICKET_CLAIMED"; ticketId: string; category: Category }
  | { type: "TICKET_APPROVED"; ticketId: string; category: Category }
  | { type: "TICKET_DECLINED"; ticketId: string; category: Category; notes?: string }
  | { type: "AWAITING_APPROVAL"; ticketId: string; locationId: string }
  | { type: "RESOLVED"; ticketId: string; locationId: string }
  | { type: "APPROVAL_DECISION"; ticketId: string; recipientId: string; decision: "APPROVED" | "DECLINED" }
  | { type: "USER_WELCOME"; recipientEmail: string; recipientName: string; temporaryPassword: string }
  | { type: "VIDEO_REQUEST_OPENED"; videoRequestId: string; locationId: string };

const QUEUE_NAME = "notifications";

let _queue: Queue<NotificationJobData> | null = null;

function getQueue(): Queue<NotificationJobData> {
  if (!_queue) {
    _queue = new Queue(QUEUE_NAME, { connection: redis as unknown as ConnectionOptions }) as Queue<NotificationJobData>;
  }
  return _queue;
}

export const notificationService = {
  async enqueueTicketOpened(ticketId: string, locationId: string, category: Category) {
    await getQueue()
      .add("ticket-opened", { type: "TICKET_OPENED", ticketId, locationId, category })
      .catch((err: unknown) =>
        logger.error("Failed to enqueue TICKET_OPENED notification", {
          ticket_id: ticketId,
          error: String(err),
        }),
      );
  },

  async enqueueTicketClaimed(ticketId: string, category: Category) {
    await getQueue()
      .add("ticket-claimed", { type: "TICKET_CLAIMED", ticketId, category })
      .catch((err: unknown) =>
        logger.error("Failed to enqueue TICKET_CLAIMED notification", {
          ticket_id: ticketId,
          error: String(err),
        }),
      );
  },

  async enqueueTicketApproved(ticketId: string, category: Category) {
    await getQueue()
      .add("ticket-approved", { type: "TICKET_APPROVED", ticketId, category })
      .catch((err: unknown) =>
        logger.error("Failed to enqueue TICKET_APPROVED notification", {
          ticket_id: ticketId,
          error: String(err),
        }),
      );
  },

  async enqueueTicketDeclined(ticketId: string, category: Category, notes?: string) {
    await getQueue()
      .add("ticket-declined", { type: "TICKET_DECLINED", ticketId, category, notes })
      .catch((err: unknown) =>
        logger.error("Failed to enqueue TICKET_DECLINED notification", {
          ticket_id: ticketId,
          error: String(err),
        }),
      );
  },

  async enqueueAwaitingApproval(ticketId: string, locationId: string) {
    await getQueue()
      .add("awaiting-approval", { type: "AWAITING_APPROVAL", ticketId, locationId })
      .catch((err: unknown) =>
        logger.error("Failed to enqueue AWAITING_APPROVAL notification", {
          ticket_id: ticketId,
          error: String(err),
        }),
      );
  },

  async enqueueResolved(ticketId: string, locationId: string) {
    await getQueue()
      .add("resolved", { type: "RESOLVED", ticketId, locationId })
      .catch((err: unknown) =>
        logger.error("Failed to enqueue RESOLVED notification", {
          ticket_id: ticketId,
          error: String(err),
        }),
      );
  },

  async enqueueApprovalDecision(
    ticketId: string,
    recipientId: string,
    decision: "APPROVED" | "DECLINED",
  ) {
    await getQueue()
      .add("approval-decision", {
        type: "APPROVAL_DECISION",
        ticketId,
        recipientId,
        decision,
      })
      .catch((err: unknown) =>
        logger.error("Failed to enqueue APPROVAL_DECISION notification", {
          ticket_id: ticketId,
          error: String(err),
        }),
      );
  },

  async enqueueVideoRequestOpened(videoRequestId: string, locationId: string) {
    await getQueue()
      .add("video-request-opened", { type: "VIDEO_REQUEST_OPENED", videoRequestId, locationId })
      .catch((err: unknown) =>
        logger.error("Failed to enqueue VIDEO_REQUEST_OPENED notification", {
          video_request_id: videoRequestId,
          error: String(err),
        }),
      );
  },

  async enqueueUserWelcome(recipientEmail: string, recipientName: string, temporaryPassword: string) {
    await getQueue()
      .add("user-welcome", { type: "USER_WELCOME", recipientEmail, recipientName, temporaryPassword })
      .catch((err: unknown) =>
        logger.error("Failed to enqueue USER_WELCOME notification", {
          error: String(err),
        }),
      );
  },
};
