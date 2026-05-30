import { PrismaClient, Role, Category } from "@prisma/client";
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
