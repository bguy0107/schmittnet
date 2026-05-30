import { Worker, type Job } from "bullmq";
import { createTransport } from "nodemailer";
import { prisma } from "@/src/lib/prisma";
import { redis } from "@/src/lib/redis";
import { env } from "@/src/lib/env";
import { logger } from "@/src/lib/logger";
import type { NotificationJobData } from "@/src/services/notification-service";

const QUEUE_NAME = "notifications";

// Email transport (Gmail SMTP). Only initialised when credentials are present.
function makeEmailTransport() {
  if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) return null;
  return createTransport({
    service: "gmail",
    auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD },
  });
}

async function sendEmail(
  transport: ReturnType<typeof makeEmailTransport>,
  to: string,
  subject: string,
  text: string,
) {
  if (!transport || !env.GMAIL_USER) return;
  try {
    await transport.sendMail({ from: env.GMAIL_USER, to, subject, text });
    logger.info("Email sent", { to, subject });
  } catch (err) {
    logger.error("Email send failed", { to, subject, error: String(err) });
  }
}

async function sendDiscord(webhookUrl: string, message: string) {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    });
    if (!res.ok) throw new Error(`Discord returned ${res.status}`);
    logger.info("Discord notification sent", { webhook: webhookUrl.slice(0, 40) });
  } catch (err) {
    logger.error("Discord notification failed", { error: String(err) });
  }
}

async function notifyUsers(
  users: Array<{
    email: string | null;
    notificationEmail: boolean;
    notificationDiscord: string | null;
  }>,
  subject: string,
  body: string,
  emailTransport: ReturnType<typeof makeEmailTransport>,
) {
  await Promise.allSettled(
    users.flatMap((u) => {
      const jobs = [];
      if (u.notificationEmail && u.email) {
        jobs.push(sendEmail(emailTransport, u.email, subject, body));
      }
      if (u.notificationDiscord) {
        jobs.push(sendDiscord(u.notificationDiscord, `**${subject}**\n${body}`));
      }
      return jobs;
    }),
  );
}

async function processJob(
  job: Job<NotificationJobData>,
  emailTransport: ReturnType<typeof makeEmailTransport>,
) {
  const { data } = job;

  if (data.type === "TICKET_OPENED") {
    const [ticket, techs] = await Promise.all([
      prisma.ticket.findUnique({
        where: { id: data.ticketId },
        select: { id: true, location: { select: { name: true } } },
      }),
      prisma.user.findMany({
        where: {
          role: "TECHNICIAN",
          isActive: true,
          categories: { has: data.category },
        },
        select: { email: true, notificationEmail: true, notificationDiscord: true },
      }),
    ]);

    if (!ticket) return;
    const subject = `[SchmittNet] New ${data.category} Ticket — ${ticket.location.name}`;
    const body = `A new ticket (#${data.ticketId.slice(0, 8).toUpperCase()}) has been submitted at ${ticket.location.name}.`;
    await notifyUsers(techs, subject, body, emailTransport);
  }

  if (data.type === "AWAITING_APPROVAL" || data.type === "RESOLVED") {
    const location = await prisma.location.findFirst({
      where: { tickets: { some: { id: data.ticketId } } },
      select: { ownerId: true, name: true },
    });
    if (!location) return;

    const staff = await prisma.user.findMany({
      where: {
        ownerId: location.ownerId,
        role: { in: ["OWNER", "OWNER_STAFF"] },
        isActive: true,
      },
      select: { email: true, notificationEmail: true, notificationDiscord: true },
    });

    const isApproval = data.type === "AWAITING_APPROVAL";
    const subject = isApproval
      ? `[SchmittNet] Approval Required — ${location.name}`
      : `[SchmittNet] Ticket Resolved — ${location.name}`;
    const body = isApproval
      ? `Ticket #${data.ticketId.slice(0, 8).toUpperCase()} at ${location.name} is awaiting budget approval.`
      : `Ticket #${data.ticketId.slice(0, 8).toUpperCase()} at ${location.name} has been resolved.`;

    await notifyUsers(staff, subject, body, emailTransport);
  }

  if (data.type === "APPROVAL_DECISION") {
    const recipient = await prisma.user.findUnique({
      where: { id: data.recipientId },
      select: { email: true, notificationEmail: true, notificationDiscord: true },
    });
    if (!recipient) return;

    const subject = `[SchmittNet] Approval ${data.decision === "APPROVED" ? "Approved" : "Declined"}`;
    const body = `Your approval request for ticket #${data.ticketId.slice(0, 8).toUpperCase()} was ${data.decision.toLowerCase()}.`;
    await notifyUsers([recipient], subject, body, emailTransport);
  }
}

export function startNotificationWorker() {
  const emailTransport = makeEmailTransport();

  const worker = new Worker<NotificationJobData>(
    QUEUE_NAME,
    async (job) => {
      logger.info("Processing notification job", { job_id: job.id, type: job.data.type });
      await processJob(job, emailTransport);
    },
    {
      connection: redis,
      concurrency: 5,
    },
  );

  worker.on("completed", (job) => {
    logger.info("Notification job completed", { job_id: job.id });
  });

  worker.on("failed", (job, err) => {
    logger.error("Notification job failed", {
      job_id: job?.id,
      error: String(err),
    });
  });

  return worker;
}
