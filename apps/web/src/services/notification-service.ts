import { Queue } from "bullmq";
import { redis } from "@/src/lib/redis";
import { logger } from "@/src/lib/logger";
import type { Category } from "@schmittnet/types";

export type NotificationJobData =
  | { type: "TICKET_OPENED"; ticketId: string; locationId: string; category: Category }
  | { type: "AWAITING_APPROVAL"; ticketId: string; locationId: string }
  | { type: "RESOLVED"; ticketId: string; locationId: string }
  | { type: "APPROVAL_DECISION"; ticketId: string; recipientId: string; decision: "APPROVED" | "DECLINED" };

const QUEUE_NAME = "notifications";

let _queue: Queue<NotificationJobData> | null = null;

function getQueue(): Queue<NotificationJobData> {
  if (!_queue) {
    _queue = new Queue(QUEUE_NAME, { connection: redis }) as Queue<NotificationJobData>;
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
};
