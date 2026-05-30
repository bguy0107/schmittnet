# SchmittNet

Restaurant IT & Maintenance Ticketing System — a mobile-first web app for 25 restaurant locations across two ownership groups. Store staff submit tickets by scanning a per-location QR code (no login required); technicians, owners, and a super-admin manage them via an authenticated dashboard.

---

## Quick start (local development)

**Prerequisites:** Node.js 22+, Docker Desktop

```bash
# 1. Install dependencies
npm install

# 2. Start PostgreSQL, Redis, and MinIO
docker compose -f infra/docker-compose.dev.yml up -d

# 3. Copy env and run migrations
cp apps/web/.env.example apps/web/.env.local
# Edit .env.local if needed (defaults work out of the box)
cd apps/web
npx prisma migrate dev
npm run db:seed

# 4. Start the dev server
npm run dev
```

App runs at **http://localhost:3000**

> **Note:** If port 5432 is already in use by another local Postgres, the dev compose file maps to **5433**. Update `DATABASE_URL` in `.env.local` accordingly (`localhost:5433`).

---

## Seeded test accounts

| Email | Password | Role | Access |
|---|---|---|---|
| `admin@schmittnet.local` | `Admin1234!` | Super Admin | Full access — users, locations, QR codes, all tickets |
| `tech@schmittnet.local` | `Tech1234!` | Technician | All tickets (IT + Maintenance), status updates, notes |
| `owner-a@schmittnet.local` | `OwnerA1234!` | Owner | Group A locations only, budget approvals, dashboard |
| `owner-b@schmittnet.local` | `OwnerB1234!` | Owner | Group B locations only, budget approvals, dashboard |

Sign in at **http://localhost:3000/login**

### Sample QR submission URL (Location A-1)

```
http://localhost:3000/submit/ab02cf652a54c91075aa582684b4d016644a5c976804eed8e559e7d5172dd9fe
```

All seeded QR tokens are deterministic (SHA-256 of location name), so they stay the same across re-seeds.

---

## Project structure

```
schmittnet/
├── apps/web/               # Next.js 16 app (frontend + API routes)
│   ├── app/                # App Router pages
│   │   ├── (public)/       # Unauthenticated QR submission form
│   │   ├── (auth)/         # Login page
│   │   └── (dashboard)/    # Authenticated views (tickets, owner, admin)
│   ├── app/api/            # REST API route handlers (thin wrappers)
│   ├── components/
│   │   ├── ui/             # shadcn/ui-style primitives
│   │   └── features/       # Feature components
│   ├── hooks/              # TanStack Query hooks
│   ├── lib/                # Client-side helpers (api.ts, utils.ts)
│   ├── src/
│   │   ├── services/       # Business logic layer
│   │   ├── repositories/   # Data access layer (Prisma)
│   │   ├── workers/        # BullMQ notification worker
│   │   └── lib/            # Server-side singletons (prisma, redis, minio, logger)
│   └── prisma/             # Schema + migrations + seed
├── packages/
│   ├── types/              # Shared TypeScript types
│   └── utils/              # Shared utilities
└── infra/                  # Docker Compose + Caddyfile
```

---

## Key commands

```bash
# Tests
npm test                        # unit + integration (Vitest)
npm run test:coverage           # with coverage report
npm run test:e2e                # Playwright (mobile viewport)

# Database
npx prisma migrate dev --name <name>   # create + apply migration
npx prisma migrate deploy              # apply in production
npx prisma studio                      # open DB GUI
npm run db:seed                        # re-seed locations + test users

# Services
docker compose -f infra/docker-compose.dev.yml up -d    # start dev stack
docker compose -f infra/docker-compose.dev.yml down     # stop dev stack
docker compose -f infra/docker-compose.dev.yml down -v  # stop + wipe volumes
```

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 3 + shadcn/ui |
| Data fetching | TanStack Query 5 |
| Forms | React Hook Form + Zod |
| ORM | Prisma 5 + PostgreSQL 18 |
| Queue | BullMQ + Redis 7 |
| Storage | MinIO (S3-compatible) |
| Auth | Auth.js v5 (Credentials, JWT) |
| Notifications | Discord webhooks + Gmail SMTP (via BullMQ worker) |
| Reverse proxy | Caddy (production) |
| Deployment | Docker Compose + GitHub Actions → SSH |

---

## Environment variables

Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in the blanks.

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `MINIO_*` | MinIO / S3 credentials and endpoint |
| `AUTH_SECRET` | 32-char random string — `openssl rand -hex 32` |
| `GMAIL_USER` | Gmail address for email notifications (optional) |
| `GMAIL_APP_PASSWORD` | Gmail app password (optional) |

---

## Deployment

Push to `main` triggers GitHub Actions CI → build → SSH deploy to VPS. See `.github/workflows/` and `infra/docker-compose.yml`.

Required GitHub Actions secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`.
