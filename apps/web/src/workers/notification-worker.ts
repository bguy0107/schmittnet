import { Worker, type Job, type ConnectionOptions } from "bullmq";
import { createTransport } from "nodemailer";
import { prisma } from "@/src/lib/prisma";
import { redis } from "@/src/lib/redis";
import { env } from "@/src/lib/env";
import { logger } from "@/src/lib/logger";
import { settingRepository } from "@/src/repositories/setting-repository";
import type { NotificationJobData } from "@/src/services/notification-service";
import type { Category } from "@schmittnet/types";

const QUEUE_NAME = "notifications";

type DiscordEmbed = {
  title: string;
  url?: string;
  description?: string;
  color: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer: { text: string };
  timestamp: string;
};


function ticketUrl(ticketId: string): string | undefined {
  return env.APP_URL ? `${env.APP_URL}/tickets/${ticketId}` : undefined;
}

function makeEmbed(fields: Omit<DiscordEmbed, "footer" | "timestamp">): DiscordEmbed {
  return { ...fields, footer: { text: "SchmittNet Ticketing" }, timestamp: new Date().toISOString() };
}

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

async function sendDiscordEmbed(webhookUrl: string, e: DiscordEmbed, roleId?: string | null) {
  try {
    const payload: Record<string, unknown> = { embeds: [e] };
    if (roleId) {
      payload.content = `<@&${roleId}>`;
      payload.allowed_mentions = { roles: [roleId] };
    }
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
  }>,
  subject: string,
  body: string,
  emailTransport: ReturnType<typeof makeEmailTransport>,
) {
  await Promise.allSettled(
    users
      .filter((u) => u.notificationEmail && u.email)
      .map((u) => sendEmail(emailTransport, u.email!, subject, body)),
  );
}

async function notifyDepartment(
  category: Category,
  discordEmbed: DiscordEmbed,
) {
  const [webhookUrl, roleId] = await Promise.all([
    settingRepository.getDiscordWebhook(category),
    settingRepository.getDiscordRoleId(category),
  ]);
  if (webhookUrl) {
    await sendDiscordEmbed(webhookUrl, discordEmbed, roleId);
  }
}

function truncate(text: string, max = 300): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
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
        select: {
          id: true,
          description: true,
          category: true,
          location: { select: { name: true } },
        },
      }),
      prisma.user.findMany({
        where: { role: "TECHNICIAN", isActive: true, categories: { has: data.category } },
        select: { email: true, notificationEmail: true },
      }),
    ]);
    if (!ticket) return;

    const ref = data.ticketId.slice(0, 8).toUpperCase();
    const label = ticket.category === "IT" ? "💻 IT" : "🔧 Maintenance";
    const subject = `[SchmittNet] New ${data.category} Ticket — ${ticket.location.name}`;
    const body = `A new ticket (#${ref}) has been submitted at ${ticket.location.name}.`;
    const dEmbed = makeEmbed({
      title: `${label} Ticket Opened`,
      url: ticketUrl(ticket.id),
      color: 0x5865f2,
      fields: [
        { name: "Location", value: ticket.location.name },
        { name: "Issue", value: truncate(ticket.description) },
        { name: "Reference", value: `#${ref}` },
      ],
    });

    await Promise.all([
      notifyUsers(techs, subject, body, emailTransport),
      notifyDepartment(data.category, dEmbed),
    ]);
  }

  if (data.type === "AWAITING_APPROVAL" || data.type === "RESOLVED") {
    const ticket = await prisma.ticket.findUnique({
      where: { id: data.ticketId },
      select: {
        description: true,
        location: { select: { ownerId: true, name: true } },
      },
    });
    if (!ticket) return;

    const staff = await prisma.user.findMany({
      where: {
        ownerId: ticket.location.ownerId,
        role: { in: ["OWNER", "OWNER_STAFF"] },
        isActive: true,
      },
      select: { email: true, notificationEmail: true },
    });

    const ref = data.ticketId.slice(0, 8).toUpperCase();
    const isApproval = data.type === "AWAITING_APPROVAL";
    const subject = isApproval
      ? `[SchmittNet] Approval Required — ${ticket.location.name}`
      : `[SchmittNet] Ticket Resolved — ${ticket.location.name}`;
    const body = isApproval
      ? `Ticket #${ref} at ${ticket.location.name} is awaiting budget approval.`
      : `Ticket #${ref} at ${ticket.location.name} has been resolved.`;

    await notifyUsers(staff, subject, body, emailTransport);
  }

  if (data.type === "TICKET_CLAIMED") {
    const ticket = await prisma.ticket.findUnique({
      where: { id: data.ticketId },
      select: {
        id: true,
        description: true,
        category: true,
        location: { select: { name: true } },
        assignee: { select: { name: true } },
      },
    });
    if (!ticket) return;

    const ref = data.ticketId.slice(0, 8).toUpperCase();
    const label = ticket.category === "IT" ? "💻 IT" : "🔧 Maintenance";
    const dEmbed = makeEmbed({
      title: `${label} Ticket In Progress`,
      url: ticketUrl(ticket.id),
      color: 0x5865f2,
      fields: [
        { name: "Location", value: ticket.location.name },
        { name: "Issue", value: truncate(ticket.description) },
        { name: "Assigned", value: ticket.assignee?.name ?? "Unknown" },
        { name: "Reference", value: `#${ref}` },
      ],
    });

    await notifyDepartment(data.category, dEmbed);
  }

  if (data.type === "VIDEO_REQUEST_OPENED") {
    const [request, techs] = await Promise.all([
      prisma.videoRequest.findUnique({
        where: { id: data.videoRequestId },
        select: {
          id: true,
          requestingParty: true,
          cameraAreas: true,
          location: { select: { name: true } },
        },
      }),
      prisma.user.findMany({
        where: { role: "TECHNICIAN", isActive: true, categories: { has: "IT" } },
        select: { email: true, notificationEmail: true },
      }),
    ]);
    if (!request) return;

    const ref = data.videoRequestId.slice(0, 8).toUpperCase();
    const partyLabel = request.requestingParty === "LAW_ENFORCEMENT" ? "Law Enforcement" : "Internal";
    const subject = `[SchmittNet] New Video Footage Request — ${request.location.name}`;
    const body = `A video footage request (#${ref}) has been submitted at ${request.location.name} by ${partyLabel}.`;

    const [webhookUrl, roleId] = await Promise.all([
      settingRepository.getDiscordWebhook("IT"),
      settingRepository.getDiscordRoleId("IT"),
    ]);

    const dEmbed = makeEmbed({
      title: "📹 Video Footage Request",
      color: 0xe67e22,
      fields: [
        { name: "Location", value: request.location.name },
        { name: "Camera / Area", value: truncate(request.cameraAreas, 100) },
        { name: "Requesting Party", value: partyLabel },
        { name: "Reference", value: `#${ref}` },
      ],
    });

    await Promise.all([
      notifyUsers(techs, subject, body, emailTransport),
      webhookUrl ? sendDiscordEmbed(webhookUrl, dEmbed, roleId) : Promise.resolve(),
    ]);
  }

  if (data.type === "USER_WELCOME") {
    const appUrl = env.APP_URL ?? "https://schmittnet.app";
    const subject = "[SchmittNet] Welcome to SchmittNet";
    const text =
      `Hi ${data.recipientName},\n\n` +
      `Your SchmittNet account has been created. Your login details are below.\n\n` +
      `  URL:      ${appUrl}\n` +
      `  Email:    ${data.recipientEmail}\n` +
      `  Password: ${data.temporaryPassword}\n\n` +
      `Please change your password after your first login.\n\n` +
      `If you have any questions, contact your administrator.\n\n` +
      `— SchmittNet`;
    await sendEmail(emailTransport, data.recipientEmail, subject, text);
    return;
  }

  if (data.type === "APPROVAL_DECISION") {
    const recipient = await prisma.user.findUnique({
      where: { id: data.recipientId },
      select: { email: true, notificationEmail: true },
    });
    if (!recipient) return;

    const ref = data.ticketId.slice(0, 8).toUpperCase();
    const approved = data.decision === "APPROVED";
    const subject = `[SchmittNet] Approval ${approved ? "Approved" : "Declined"}`;
    const body = `Your approval request for ticket #${ref} was ${data.decision.toLowerCase()}.`;

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
      connection: redis as unknown as ConnectionOptions,
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
