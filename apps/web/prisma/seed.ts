import { PrismaClient, Role, Category, TicketStatus, Priority } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { randomBytes, createHash } from "crypto";

const prisma = new PrismaClient();

// Deterministic token so re-running seed doesn't change QR codes.
function deterministicToken(name: string): string {
  return createHash("sha256").update(`seed:${name}`).digest("hex");
}

async function main() {
  console.log("Seeding database...");

  const ownerA = await prisma.owner.upsert({
    where: { id: "owner-a-seed-id-00000000000" },
    update: {},
    create: { id: "owner-a-seed-id-00000000000", name: "Owner Group A" },
  });

  const ownerB = await prisma.owner.upsert({
    where: { id: "owner-b-seed-id-00000000000" },
    update: {},
    create: { id: "owner-b-seed-id-00000000000", name: "Owner Group B" },
  });

  // Locations — upsert on qrToken (unique) so seed is idempotent
  const locationsA = [
    { name: "Location A-1 — Downtown", address: "100 Main St" },
    { name: "Location A-2 — Westside", address: "200 West Ave" },
    { name: "Location A-3 — Airport", address: "300 Airport Blvd" },
  ];
  for (const loc of locationsA) {
    const qrToken = deterministicToken(loc.name);
    await prisma.location.upsert({
      where: { qrToken },
      update: { name: loc.name },
      create: { name: loc.name, address: loc.address, ownerId: ownerA.id, qrToken },
    });
  }

  const locationsB = [
    { name: "Location B-1 — Northgate", address: "400 North Rd" },
    { name: "Location B-2 — Southpark", address: "500 South Park Dr" },
    { name: "Location B-3 — Eastfield", address: "600 East Field Ln" },
  ];
  for (const loc of locationsB) {
    const qrToken = deterministicToken(loc.name);
    await prisma.location.upsert({
      where: { qrToken },
      update: { name: loc.name },
      create: { name: loc.name, address: loc.address, ownerId: ownerB.id, qrToken },
    });
  }

  await prisma.user.upsert({
    where: { email: "admin@schmittnet.local" },
    update: {},
    create: {
      email: "admin@schmittnet.local",
      name: "Super Admin",
      role: Role.SUPER_ADMIN,
      passwordHash: await hash("Admin1234!"),
    },
  });

  await prisma.user.upsert({
    where: { email: "tech@schmittnet.local" },
    update: {},
    create: {
      email: "tech@schmittnet.local",
      name: "IT Technician",
      role: Role.TECHNICIAN,
      categories: [Category.IT, Category.MAINTENANCE],
      passwordHash: await hash("Tech1234!"),
    },
  });

  await prisma.user.upsert({
    where: { email: "owner-a@schmittnet.local" },
    update: {},
    create: {
      email: "owner-a@schmittnet.local",
      name: "Owner A",
      role: Role.OWNER,
      ownerId: ownerA.id,
      passwordHash: await hash("OwnerA1234!"),
    },
  });

  await prisma.user.upsert({
    where: { email: "owner-b@schmittnet.local" },
    update: {},
    create: {
      email: "owner-b@schmittnet.local",
      name: "Owner B",
      role: Role.OWNER,
      ownerId: ownerB.id,
      passwordHash: await hash("OwnerB1234!"),
    },
  });

  // Fetch seeded entities needed for ticket relations
  const tech = await prisma.user.findUniqueOrThrow({ where: { email: "tech@schmittnet.local" }, select: { id: true } });
  const locA1 = await prisma.location.findUniqueOrThrow({ where: { qrToken: deterministicToken("Location A-1 — Downtown") }, select: { id: true } });
  const locA2 = await prisma.location.findUniqueOrThrow({ where: { qrToken: deterministicToken("Location A-2 — Westside") }, select: { id: true } });
  const locA3 = await prisma.location.findUniqueOrThrow({ where: { qrToken: deterministicToken("Location A-3 — Airport") }, select: { id: true } });
  const locB1 = await prisma.location.findUniqueOrThrow({ where: { qrToken: deterministicToken("Location B-1 — Northgate") }, select: { id: true } });
  const locB2 = await prisma.location.findUniqueOrThrow({ where: { qrToken: deterministicToken("Location B-2 — Southpark") }, select: { id: true } });
  const locB3 = await prisma.location.findUniqueOrThrow({ where: { qrToken: deterministicToken("Location B-3 — Eastfield") }, select: { id: true } });

  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

  const seedTickets = [
    {
      id: "ticket-seed-01",
      locationId: locA1.id,
      category: Category.IT,
      priority: Priority.P1,
      status: TicketStatus.OPEN,
      description: "WiFi is down in the dining area. Staff cannot process mobile orders. Router rebooted but still no connection.",
      createdAt: daysAgo(1),
    },
    {
      id: "ticket-seed-02",
      locationId: locB1.id,
      category: Category.MAINTENANCE,
      priority: Priority.NORMAL,
      status: TicketStatus.OPEN,
      description: "Grease trap inspection due — last serviced 90 days ago. Health inspection is next week.",
      deadline: new Date(now.getTime() + 6 * 86_400_000),
      createdAt: daysAgo(2),
    },
    {
      id: "ticket-seed-03",
      locationId: locA3.id,
      category: Category.IT,
      priority: Priority.P0,
      status: TicketStatus.IN_PROGRESS,
      description: "POS terminal at register 2 cannot reach payment processor. Card transactions failing. Register 1 is working.",
      assignedTo: tech.id,
      acknowledgedAt: daysAgo(0),
      createdAt: daysAgo(0),
    },
    {
      id: "ticket-seed-04",
      locationId: locB2.id,
      category: Category.MAINTENANCE,
      priority: Priority.P2,
      status: TicketStatus.IN_PROGRESS,
      description: "Ceiling fan in the kitchen is wobbling and making noise. Screws appear loose.",
      assignedTo: tech.id,
      acknowledgedAt: daysAgo(1),
      createdAt: daysAgo(3),
    },
    {
      id: "ticket-seed-05",
      locationId: locA2.id,
      category: Category.IT,
      priority: Priority.NORMAL,
      status: TicketStatus.ON_HOLD,
      description: "Security camera above the back entrance is offline. Footage shows static since Tuesday.",
      assignedTo: tech.id,
      acknowledgedAt: daysAgo(4),
      onHoldReason: "Waiting for replacement NVR firmware from vendor. ETA 3 business days.",
      createdAt: daysAgo(5),
    },
    {
      id: "ticket-seed-06",
      locationId: locA1.id,
      category: Category.MAINTENANCE,
      priority: Priority.P1,
      status: TicketStatus.AWAITING_APPROVAL,
      description: "HVAC compressor in the main dining room has failed. Unit is 12 years old and not repairable. Replacement quote: $4,200.",
      assignedTo: tech.id,
      acknowledgedAt: daysAgo(6),
      deadline: new Date(now.getTime() + 3 * 86_400_000),
      createdAt: daysAgo(7),
    },
    {
      id: "ticket-seed-07",
      locationId: locB3.id,
      category: Category.IT,
      priority: Priority.NORMAL,
      status: TicketStatus.RESOLVED,
      description: "Managed switch in the server closet was dropping packets intermittently. Staff reported slow network for two days.",
      assignedTo: tech.id,
      acknowledgedAt: daysAgo(10),
      resolvedAt: daysAgo(9),
      createdAt: daysAgo(11),
    },
    {
      id: "ticket-seed-08",
      locationId: locA2.id,
      category: Category.MAINTENANCE,
      priority: Priority.NORMAL,
      status: TicketStatus.CANCELLED,
      description: "Front door hinge squeaking. Staff reported it was already lubricated before tech arrived.",
      createdAt: daysAgo(14),
    },
  ] as const;

  for (const ticket of seedTickets) {
    await prisma.ticket.upsert({
      where: { id: ticket.id },
      update: {},
      create: ticket,
    });
  }

  // Approval request for the AWAITING_APPROVAL ticket
  await prisma.ticketApproval.upsert({
    where: { id: "approval-seed-01" },
    update: {},
    create: {
      id: "approval-seed-01",
      ticketId: "ticket-seed-06",
      requestedBy: tech.id,
      status: "PENDING",
      notes: "Obtained two quotes; lowest is $4,200. Unit is past end-of-life — repair not viable.",
      createdAt: daysAgo(5),
    },
  });

  // Seed history entries
  await prisma.ticketHistory.upsert({
    where: { id: "note-seed-01" },
    update: {},
    create: {
      id: "note-seed-01",
      ticketId: "ticket-seed-05",
      authorId: tech.id,
      type: "NOTE",
      content: "Confirmed camera hardware is fine. Issue is NVR firmware bug introduced in v3.1.2. Vendor acknowledged and is issuing patch.",
      createdAt: daysAgo(3),
    },
  });

  await prisma.ticketHistory.upsert({
    where: { id: "note-seed-02" },
    update: {},
    create: {
      id: "note-seed-02",
      ticketId: "ticket-seed-07",
      authorId: tech.id,
      type: "NOTE",
      content: "Replaced 8-port managed switch with spare from inventory. Network stable for 24 hours. Closing ticket.",
      createdAt: daysAgo(9),
    },
  });

  // Print the QR token for Location A-1 — useful for E2E tests
  const a1Token = deterministicToken("Location A-1 — Downtown");
  console.log("\nSeed complete. Test accounts:");
  console.log("  admin@schmittnet.local   / Admin1234!");
  console.log("  tech@schmittnet.local    / Tech1234!");
  console.log("  owner-a@schmittnet.local / OwnerA1234!");
  console.log("  owner-b@schmittnet.local / OwnerB1234!");
  console.log(`\nSample QR URL: http://localhost:3000/submit/${a1Token}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
