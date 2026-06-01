# CLAUDE.md

Restaurant IT & Maintenance Ticketing System — a mobile-first web app for 25 restaurant
locations across two ownership groups. Store staff submit IT/maintenance tickets by scanning
a per-location QR code (no login); technicians, owners, and a super-admin manage them via an
authenticated interface.

## Reference docs (read on demand — don't duplicate here)

These are the source of truth. Read the relevant one before non-trivial work; don't load both
unless needed.

- `docs/PRD_SchmittNet.docx` — product requirements: user roles, user stories, functional reqs
  (FR-01…FR-20), ticket lifecycle, notification model, KPIs, open questions.
- `docs/Technical_Architecture_SchmittNet.docx` — authoritative engineering reference: stack,
  data models, API design, auth, security, ADRs (ADR-001…ADR-008), runbook.

Read with: `extract-text docs/<file>.docx` (or `pandoc <file>.docx -o -`).

## Stack (one line)

Next.js 16 (App Router, web + API routes) · TypeScript strict · Tailwind + shadcn/ui ·
TanStack Query · React Hook Form + Zod · Prisma 5 + PostgreSQL 18 · BullMQ + Redis 7 ·
MinIO (S3-compatible) · Auth.js v5 (Credentials, server-side sessions) · Docker Compose +
Caddy on a single VPS. Monorepo; app lives in `apps/web`.

## Key commands

```bash
# Local dev
docker compose -f infra/docker-compose.dev.yml up -d   # PostgreSQL, Redis, MinIO
npx prisma migrate dev                                  # apply migrations
npm run db:seed                                         # seed locations + test users
npm run dev                                             # Next.js dev server

# Tests
npm test                       # unit + integration (Vitest + Supertest)
npm run test:e2e               # Playwright, mobile viewport (390x844)
npm test -- ticket-service.test.ts

# DB
npx prisma migrate dev --name <name>
npx prisma generate            # after any schema change
npx prisma studio
```

Deploy is automatic on push to `main` (GitHub Actions → SSH → `docker compose pull && up -d`).
`main` = production, `staging` branch = staging.

## Conventions (enforce; see arch doc §7 for full list)

- Files/folders kebab-case; components PascalCase; functions camelCase; constants/env
  UPPER_SNAKE_CASE; DB tables snake_case plural.
- Repository pattern for all DB access — **no raw Prisma in route handlers**.
- Service layer holds business logic — route handlers stay thin.
- Zod validates **all** external input (request bodies, form data, env vars at startup).
- No `any` — use `unknown` + narrowing. No business logic in UI components.
- Max ~300 lines/file. Comments explain *why*, not *what*.
- No hardcoded location IDs, user IDs, tokens, or secrets anywhere.

## Non-negotiable guardrails (getting these wrong is a security/correctness bug)

- **Auth in the service/route layer, not middleware alone.** Next.js middleware is bypassable
  (CVE-2025-29927); treat it as a convenience filter only.
- **Owner data isolation at the DB query level** via `owner_id` scoping — never UI-only. This
  prevents cross-owner leakage and is the highest-severity risk in the PRD.
- **Sessions are server-side** (Postgres, opaque HttpOnly cookie), not stateless JWT — required
  for instant revocation on logout/role change/deactivation (ADR-006).
- **No hard deletes.** Users/locations soft-disable via `is_active`; tickets are never deleted.
- **QR tokens** are crypto-random (32 bytes hex), never sequential. Public submission endpoint
  is rate-limited **per-token (primary) + per-IP (secondary)** — staff share NAT IPs.
- **Media uploads** go via short-lived presigned PUT URLs straight to MinIO (ADR-008) — never
  buffer large files through the app process. Validate MIME/size when issuing the URL and
  verify the object afterward.
- **Notifications fire only on:** ticket Opened (→ technicians), Claimed/Started — OPEN→IN_PROGRESS
  only (→ department channel + role), Awaiting Approval (→ owner/owner staff), Resolved (→ owner/
  owner staff), and approval approved/declined (→ requesting technician). **No** notification when
  resuming from On Hold. Dispatch is async via BullMQ.
- Never log PII, passwords, tokens, or full file paths.

## Ticket lifecycle

`OPEN → IN_PROGRESS → ON_HOLD / AWAITING_APPROVAL → RESOLVED`, plus terminal `CANCELLED`.
Awaiting Approval may be skipped; a declined approval returns the ticket to In Progress.

## Roles

`SUPER_ADMIN` (full access: users, locations, QR codes) · `OWNER` / `OWNER_STAFF` (own
locations only; approve budget) · `TECHNICIAN` (resolve tickets by category; may cover IT,
Maintenance, or both; optionally owner-scoped).

## Notes

- Mobile-first is the primary use case — design and test at mobile viewport first.
- Auth.js v5 is still beta: pin a release and validate Credentials + server-side sessions +
  Next.js 16 `proxy.ts` early (PRD Q3 / arch Q8).
