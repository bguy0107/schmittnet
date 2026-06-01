import { Worker, type Job, type ConnectionOptions } from "bullmq";
import { createTransport } from "nodemailer";
import { prisma } from "@/src/lib/prisma";
import { redis } from "@/src/lib/redis";
import { env } from "@/src/lib/env";
import { logger } from "@/src/lib/logger";
import { settingRepository } from "@/src/repositories/setting-repository";
import { watcherRepository } from "@/src/repositories/watcher-repository";
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

const PRIORITY_COLOR: Record<string, number> = {
  P0: 0xed4245,
  P1: 0xff9800,
  P2: 0xfee75c,
  NORMAL: 0x5865f2,
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
    notificationDiscord: string | null;
  }>,
  subject: string,
  body: string,
  discordEmbed: DiscordEmbed,
  emailTransport: ReturnType<typeof makeEmailTransport>,
) {
  await Promise.allSettled(
    users.flatMap((u) => {
      const jobs = [];
      if (u.notificationEmail && u.email) {
        jobs.push(sendEmail(emailTransport, u.email, subject, body));
      }
      if (u.notificationDiscord) {
        jobs.push(sendDiscordEmbed(u.notificationDiscord, discordEmbed));
      }
      return jobs;
    }),
  );
}

async function notifyDepartmentAndWatchers(
  ticketId: string,
  category: Category,
  discordEmbed: DiscordEmbed,
) {
  const [departmentWebhook, roleId, watchers] = await Promise.all([
    settingRepository.getDiscordWebhook(category),
    settingRepository.getDiscordRoleId(category),
    watcherRepository.findByTicket(ticketId),
  ]);

  const seen = new Set<string>();
  const urls: string[] = [];
  if (departmentWebhook) {
    seen.add(departmentWebhook);
    urls.push(departmentWebhook);
  }
  for (const w of watchers) {
    if (!seen.has(w.webhookUrl)) {
      seen.add(w.webhookUrl);
      urls.push(w.webhookUrl);
    }
  }

  // Only ping the role on the department webhook, not watcher webhooks
  await Promise.allSettled(
    urls.map((url) =>
      sendDiscordEmbed(url, discordEmbed, url === departmentWebhook ? roleId : null),
    ),
  );
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
          priority: true,
          category: true,
          location: { select: { name: true } },
        },
      }),
      prisma.user.findMany({
        where: { role: "TECHNICIAN", isActive: true, categories: { has: data.category } },
        select: { email: true, notificationEmail: true, notificationDiscord: true },
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
      description: truncate(ticket.description),
      color: PRIORITY_COLOR[ticket.priority] ?? (PRIORITY_COLOR.NORMAL as number),
      fields: [
        { name: "Location", value: ticket.location.name, inline: true },
        { name: "Priority", value: ticket.priority, inline: true },
        { name: "Reference", value: `#${ref}`, inline: true },
      ],
    });

    await Promise.all([
      notifyUsers(techs, subject, body, dEmbed, emailTransport),
      notifyDepartmentAndWatchers(data.ticketId, data.category, dEmbed),
    ]);
  }

  if (data.type === "TICKET_IN_PROGRESS") {
    const ticket = await prisma.ticket.findUnique({
      where: { id: data.ticketId },
      select: {
        id: true,
        description: true,
        priority: true,
        location: { select: { name: true } },
        assignee: { select: { name: true } },
      },
    });
    if (!ticket) return;

    const ref = data.ticketId.slice(0, 8).toUpperCase();
    const dEmbed = makeEmbed({
      title: `🔧 Ticket In Progress`,
      url: ticketUrl(ticket.id),
      description: truncate(ticket.description),
      color: 0x5865f2,
      fields: [
        { name: "Location", value: ticket.location.name, inline: true },
        { name: "Priority", value: ticket.priority, inline: true },
        { name: "Reference", value: `#${ref}`, inline: true },
        { name: "Assigned To", value: ticket.assignee?.name ?? "Unassigned", inline: true },
      ],
    });
    await notifyDepartmentAndWatchers(data.ticketId, data.category, dEmbed);
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

    const ref = data.ticketId.slice(0, 8).toUpperCase();
    const isApproval = data.type === "AWAITING_APPROVAL";
    const subject = isApproval
      ? `[SchmittNet] Approval Required — ${location.name}`
      : `[SchmittNet] Ticket Resolved — ${location.name}`;
    const body = isApproval
      ? `Ticket #${ref} at ${location.name} is awaiting budget approval.`
      : `Ticket #${ref} at ${location.name} has been resolved.`;
    const dEmbed = makeEmbed({
      title: isApproval ? `💰 Approval Required` : `✅ Ticket Resolved`,
      url: ticketUrl(data.ticketId),
      color: isApproval ? 0xffa500 : 0x57f287,
      fields: [
        { name: "Location", value: location.name, inline: true },
        { name: "Reference", value: `#${ref}`, inline: true },
      ],
    });

    await notifyUsers(staff, subject, body, dEmbed, emailTransport);
  }

  if (data.type === "APPROVAL_DECISION") {
    const recipient = await prisma.user.findUnique({
      where: { id: data.recipientId },
      select: { email: true, notificationEmail: true, notificationDiscord: true },
    });
    if (!recipient) return;

    const ref = data.ticketId.slice(0, 8).toUpperCase();
    const approved = data.decision === "APPROVED";
    const subject = `[SchmittNet] Approval ${approved ? "Approved" : "Declined"}`;
    const body = `Your approval request for ticket #${ref} was ${data.decision.toLowerCase()}.`;
    const dEmbed = makeEmbed({
      title: approved ? `✅ Approval Approved` : `❌ Approval Declined`,
      url: ticketUrl(data.ticketId),
      color: approved ? 0x57f287 : 0xed4245,
      fields: [
        { name: "Reference", value: `#${ref}`, inline: true },
        { name: "Decision", value: approved ? "Approved" : "Declined", inline: true },
      ],
    });

    await notifyUsers([recipient], subject, body, dEmbed, emailTransport);
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
