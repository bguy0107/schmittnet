# Technical Architecture Document

**Restaurant IT & Maintenance Ticketing System**

**CONFIDENTIAL**

| Field | Value |
| --- | --- |
| Author | [Eng Lead Name] |
| Team | Engineering |
| Status | Draft |
| Version | 1.0 |
| Created | May 30, 2026 |
| Last Updated | May 30, 2026 |
| Related PRD | PRD_SchmittNet.md |

---

## 1. Overview

### 1.1 Purpose

This document describes the technical architecture for the Restaurant IT & Maintenance Ticketing System — a mobile-first web application serving 25 restaurant locations across two ownership groups. It defines system structure, technology choices, data design, deployment approach, and integration patterns to guide implementation. It is the authoritative reference for engineering decisions made during this project.

### 1.2 Scope

This document covers:

- Public-facing, unauthenticated QR code ticket submission flow
- Authenticated management interface for technicians, owners, owner staff, and super-admin
- Ticket lifecycle management (Open → In Progress → On Hold / Awaiting Approval → Resolved, with a Cancelled terminal state)
- Discord webhook and Gmail SMTP notification system
- Media upload and storage (photo/video attachments)
- Owner-scoped reporting dashboard
- Self-hosted VPS deployment via Docker Compose and Caddy

This document does not cover:

- QSRSoft migration or data import from the legacy system
- Native mobile app development (web app only)
- Future phases: offline queuing, AI triage, third-party ITSM integrations

### 1.3 Architectural Goals

| Quality Attribute | Requirement |
| --- | --- |
| Mobile-First | All UI must be fully usable on a mobile browser; ticket submission completable in under 60 seconds on a standard mobile connection |
| Performance | QR landing page and ticket form load in under 2 seconds on a 4G mobile connection; API responses under 200ms p95 |
| Reliability | 99.5% uptime target; Caddy + Docker Compose restart policies provide automatic recovery from process crashes |
| Security | Unauthenticated submission endpoints scoped to signed location tokens and rate-limited; authenticated routes use session-based auth; owner data strictly isolated at the data layer |
| Scalability | Must support all 25 locations with room to expand; single VPS sufficient for current scale |
| Maintainability | Monorepo with clear separation of concerns; TypeScript strict mode; Prisma migrations for schema changes |
| Observability | Structured JSON logging, Uptime Kuma for availability monitoring, Sentry for error tracking |

---

## 2. Technology Stack

### 2.1 Frontend

| Category | Technology & Version | Notes / Rationale |
| --- | --- | --- |
| Framework | Next.js 16.2.6 | App Router; handles both public QR form and authenticated dashboard in one app; excellent mobile rendering and SSR |
| Language | TypeScript 5.x | Strict mode enabled across all packages |
| Styling | Tailwind CSS 3.x | Mobile-first utility classes; no CSS modules; responsive design by default |
| Component Lib | shadcn/ui | Accessible, unstyled base components; easy to customize for mobile touch targets |
| State Management | React built-in (useState/useReducer) + TanStack Query 5 | Server state via TanStack Query; minimal client state needed |
| Forms | React Hook Form + Zod | Performant form handling; Zod for client-side validation matching server schema |
| Testing | Vitest + Playwright | Unit and component tests via Vitest; E2E mobile flows via Playwright |

### 2.2 Backend

| Category | Technology & Version | Notes / Rationale |
| --- | --- | --- |
| Runtime | Node.js 22 LTS | Long-term support; compatible with Next.js API routes |
| Framework | Next.js 16.2.6 API Routes | Backend co-located with frontend in monorepo; no separate server process needed |
| API Style | REST with OpenAPI spec | Simple, well-understood; easy to document and test |
| Auth | NextAuth.js v5 | Session-based auth for technicians, owners, and super-admin; server-side sessions referenced by an opaque HttpOnly cookie (enables instant revocation). Pin a specific Auth.js v5 release (still beta) and verify Credentials + sessions + Next.js 16 proxy.ts. |
| ORM | Prisma 5.x | Type-safe database access; excellent PostgreSQL support; migration tooling built-in |
| Background Jobs | BullMQ + Redis | Async notification dispatch (Discord webhooks, Gmail SMTP); prevents submission latency from notification delivery |
| Testing | Vitest + Supertest | Unit tests for services; integration tests for API routes |

### 2.3 Infrastructure & Services (All Self-Hosted on VPS)

| Category | Service | Notes |
| --- | --- | --- |
| Hosting | VPS (self-hosted) | Single VPS; all services run as Docker containers via Docker Compose |
| Reverse Proxy | Caddy | Automatic HTTPS via Let's Encrypt; mobile-optimized headers; routes traffic to Next.js container |
| Containerization | Docker + Docker Compose | Orchestrates Next.js app, PostgreSQL, Redis, and MinIO as separate services with restart policies |
| Database | PostgreSQL 18.4 | Primary data store; runs as Docker container with persistent volume mount |
| Cache / Queue | Redis 7 | BullMQ job queue backend; session cache; runs as Docker container |
| File Storage | MinIO | Self-hosted S3-compatible object storage for photo/video attachments; runs as Docker container |
| Email | Gmail SMTP via Nodemailer | Transactional email for notifications; configured via app environment variables |
| Discord Notifications | Discord Webhooks API | Per-channel webhook URLs stored in user/team settings; no bot required |
| Monitoring | Uptime Kuma | Self-hosted uptime monitoring and alerting; runs as Docker container |
| Error Tracking | Sentry (cloud free tier) | Application error tracking and stack traces; minimal external dependency |
| CI/CD | GitHub Actions + SSH deploy | Push to main triggers build; images are tagged per commit (not :latest) to allow rollback. GitHub Actions SSHs into the VPS and runs `docker compose pull && docker compose up -d`. Migrations use an expand/contract pattern so schema and code can deploy safely in either order. |

---

## 3. System Architecture

### 3.1 High-Level Diagram

`[ Architecture diagram to be added — recommended tool: Excalidraw or draw.io ]`

Diagram must show: Mobile browser → Caddy → Next.js container → PostgreSQL / Redis / MinIO, plus the BullMQ worker container, and Discord Webhook and Gmail SMTP as outbound integrations. GitHub Actions as the deployment pipeline.

### 3.2 Component Overview

| Component | Responsibility | Key Interactions |
| --- | --- | --- |
| Next.js App (Web + API) | Serves the public QR ticket form, authenticated dashboards, and all REST API routes | Talks to: PostgreSQL (via Prisma), Redis (via BullMQ), MinIO (file uploads) |
| Caddy (Reverse Proxy) | Terminates HTTPS, handles Let's Encrypt certificate renewal, proxies requests to Next.js container | Sits in front of: Next.js App |
| PostgreSQL | Primary data store for all application data: tickets, users, locations, notes, audit logs | Read/written by: Next.js App via Prisma |
| Redis | BullMQ job queue backend for async notification dispatch; session caching | Read/written by: Next.js App workers |
| BullMQ Worker | Processes notification jobs from the Redis queue and dispatches Discord webhooks and Gmail SMTP emails. Runs as its own process/container, separate from the web server. | Reads from: Redis queue; calls: Discord API, Gmail SMTP |
| MinIO | Stores photo and video attachments uploaded with tickets; S3-compatible API | Written by: Next.js upload handler; read by: technician ticket views |
| Uptime Kuma | Monitors availability of the app and key services; sends alerts on downtime | Monitors: Next.js health endpoint, Caddy |
| GitHub Actions | CI/CD pipeline; builds Docker image, SSHs into VPS, runs `docker compose up -d` on push to main | Talks to: VPS via SSH; GitHub Container Registry or DockerHub |

### 3.3 Environments

| Environment | Purpose | URL / Access | Deploy Trigger |
| --- | --- | --- | --- |
| Development | Local development with hot reload; uses local Docker Compose stack | http://localhost:3000 | Manual (`npm run dev`) |
| Staging | Pre-production validation; mirrors production config on VPS subdomain | [staging.yourdomain.com] | Push to `staging` branch |
| Production | Live system serving all 25 locations | [yourdomain.com] | Push to `main` branch |

---

## 4. Project Structure

### 4.1 Repository Layout

Monorepo structure:

```
project-root/
├── apps/
│   └── web/                  # Next.js app (frontend + API routes)
├── packages/
│   ├── types/                # Shared TypeScript types
│   └── utils/                # Shared utilities
├── infra/
│   ├── docker-compose.yml    # Full stack service definitions
│   ├── docker-compose.dev.yml
│   └── Caddyfile             # Caddy reverse proxy config
├── .github/
│   └── workflows/            # GitHub Actions CI/CD pipelines
├── docs/                     # PRD, architecture docs
└── CLAUDE.md                 # Claude Code project instructions
```

### 4.2 Frontend Structure

```
apps/web/
├── app/
│   ├── (public)/             # Unauthenticated QR ticket submission
│   │   └── submit/[token]/   # Location-specific ticket form
│   ├── (auth)/               # Login page
│   ├── (dashboard)/          # Authenticated views
│   │   ├── tickets/          # Technician ticket management
│   │   ├── owner/            # Owner dashboard & reporting
│   │   └── admin/            # Super-admin panel
│   └── api/                  # REST API route handlers
├── components/
│   ├── ui/                   # shadcn/ui base primitives
│   └── features/             # Feature-specific components
├── hooks/                    # Custom React hooks
├── lib/                      # API clients, helpers, MinIO client
└── public/                   # Static assets
```

### 4.3 Backend Structure

```
apps/web/app/api/
├── tickets/                  # Ticket CRUD and status transitions
├── locations/                # Location management
├── users/                    # User management
├── upload/                   # Media upload handler (MinIO)
├── notify/                   # Notification job enqueue
└── health/                   # Health check endpoint for monitoring

apps/web/src/
├── services/                 # Business logic layer
├── repositories/             # Data access layer (Prisma queries)
├── proxy/                    # Request filters (Next.js 16 proxy.ts): rate limiting, validation; auth verified in services
├── workers/                  # BullMQ job handlers (Discord, email)
└── lib/                      # Shared utilities, Prisma client
```

---

## 5. Data Architecture

### 5.1 Data Models

#### User

| Field | Type | Constraints | Description |
| --- | --- | --- | --- |
| id | uuid | PK, auto-gen | Primary identifier |
| email | string | unique, not null | Login email address |
| name | string | not null | Display name |
| role | enum | not null | SUPER_ADMIN \| OWNER \| OWNER_STAFF \| TECHNICIAN |
| categories | enum[] | nullable | IT \| MAINTENANCE — one or more set for TECHNICIAN (a technician may cover both); null for other roles |
| notification_discord | string | nullable | Discord webhook URL for this user |
| notification_email | boolean | not null, default true | Whether to receive email notifications |
| owner_id | uuid | FK → Owner, nullable | Set for OWNER and OWNER_STAFF (and optionally an owner-scoped TECHNICIAN); scopes access to one owner's locations |
| password_hash | string | not null | Argon2id (or bcrypt) hash of the account password; never logged or returned by the API |
| is_active | boolean | not null, default true | Soft-disable flag; deactivating revokes access immediately via server-side session invalidation |
| created_at | timestamp | not null | Record creation time |
| updated_at | timestamp | not null | Last update time |

#### Owner

| Field | Type | Constraints | Description |
| --- | --- | --- | --- |
| id | uuid | PK, auto-gen | Primary identifier |
| name | string | not null | Owner group name |
| created_at | timestamp | not null | Record creation time |

#### Location

| Field | Type | Constraints | Description |
| --- | --- | --- | --- |
| id | uuid | PK, auto-gen | Primary identifier |
| name | string | not null | Restaurant location name |
| owner_id | uuid | FK → Owner, not null | Which ownership group this location belongs to |
| qr_token | string | unique, not null | Signed token embedded in QR code URL; scopes submissions to this location |
| qr_active | boolean | not null, default true | Super-admin can deactivate a location's QR token |
| address | string | nullable | Physical address for reference |
| created_at | timestamp | not null | Record creation time |
| updated_at | timestamp | not null | Last update time |

#### Ticket

| Field | Type | Constraints | Description |
| --- | --- | --- | --- |
| id | uuid | PK, auto-gen | Primary identifier |
| location_id | uuid | FK → Location, not null | Location where the issue was submitted |
| category | enum | not null | IT \| MAINTENANCE |
| description | text | not null | Issue description entered by store staff |
| status | enum | not null, default OPEN | OPEN \| IN_PROGRESS \| ON_HOLD \| AWAITING_APPROVAL \| RESOLVED \| CANCELLED |
| deadline | timestamp | nullable | Optional completion deadline set by store staff |
| assigned_to | uuid | FK → User, nullable | Technician currently assigned to this ticket |
| priority | enum | not null, default NORMAL | P0 (service-impacting) \| P1 \| P2 \| NORMAL — set from submitter urgency, adjustable by a technician; drives response SLAs |
| acknowledged_at | timestamp | nullable | When a technician first responded to / claimed the ticket; used for the response-time KPI |
| on_hold_reason | string | nullable | Reason recorded when status = ON_HOLD (e.g., awaiting a part or vendor) |
| resolved_at | timestamp | nullable | Timestamp when ticket moved to RESOLVED |
| created_at | timestamp | not null | Ticket submission time |
| updated_at | timestamp | not null | Last status change or update time |

#### TicketMedia

| Field | Type | Constraints | Description |
| --- | --- | --- | --- |
| id | uuid | PK, auto-gen | Primary identifier |
| ticket_id | uuid | FK → Ticket, not null | Associated ticket |
| storage_key | string | not null | MinIO object key for this file |
| media_type | enum | not null | PHOTO \| VIDEO |
| mime_type | string | not null | e.g. image/jpeg, video/mp4 |
| created_at | timestamp | not null | Upload time |

#### TicketNote

| Field | Type | Constraints | Description |
| --- | --- | --- | --- |
| id | uuid | PK, auto-gen | Primary identifier |
| ticket_id | uuid | FK → Ticket, not null | Associated ticket |
| author_id | uuid | FK → User, not null | Technician or admin who wrote the note |
| content | text | not null | Note content |
| created_at | timestamp | not null | Note creation time |

#### TicketApproval

| Field | Type | Constraints | Description |
| --- | --- | --- | --- |
| id | uuid | PK, auto-gen | Primary identifier |
| ticket_id | uuid | FK → Ticket, not null | Ticket requiring budget approval |
| requested_by | uuid | FK → User, not null | Technician who triggered the approval request |
| approver_id | uuid | FK → User, nullable | Owner or owner staff who acted on the request |
| status | enum | not null, default PENDING | PENDING \| APPROVED \| DECLINED |
| notes | text | nullable | Optional reason for approval or decline |
| created_at | timestamp | not null | Request creation time |
| resolved_at | timestamp | nullable | When approval was granted or declined |

### 5.2 Relationships

- Owner has many Locations (1:N)
- Owner has many member Users — owner and owner staff — (1:N via `User.owner_id`); an owner-scoped technician may also set `owner_id`. The principal owner is the User with role OWNER and the matching `owner_id`.
- Location has many Tickets (1:N)
- Ticket has many TicketMedia (1:N)
- Ticket has many TicketNotes (1:N)
- Ticket has many TicketApprovals (1:N); at most one PENDING at any time
- User (Technician) can be assigned to many Tickets (1:N via `Ticket.assigned_to`)

### 5.3 Database Conventions

- All primary keys use UUIDs (not auto-increment integers)
- All tables include `created_at` and `updated_at` timestamps
- No hard deletes — locations and users use an `is_active` boolean flag; tickets are never deleted
- Snake_case for all column and table names
- Enum values stored as strings in PostgreSQL native enum types
- QR tokens generated as cryptographically random strings (`crypto.randomBytes`), never sequential

### 5.4 Caching Strategy

| What is Cached | TTL | Invalidation Strategy | Cache Key Pattern |
| --- | --- | --- | --- |
| User session | 24h | On logout / role change | `session:{sessionId}` |
| Rate limit counter (QR submission) | 1 min | TTL expiry only | `ratelimit:submit:{token}:{ip}` |
| Notification job queue | N/A (BullMQ managed) | Job completion / failure | `bull:notifications:{jobId}` |

---

## 6. API Design

### 6.1 API Conventions

- Base URL: `https://[yourdomain.com]/api`
- All requests and responses use JSON (`Content-Type: application/json`)
- Authenticated routes require a valid NextAuth.js session cookie
- Snake_case for JSON field names
- ISO 8601 for all date/time fields
- Errors return `{ error: { code, message, details } }` — consistent across all routes
- Rate limiting enforced on public submission endpoint: per-token sliding window plus a secondary per-IP limit (see Security)

### 6.2 Core Endpoints

| Method | Endpoint | Auth Required | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/[...nextauth]` | No | NextAuth.js login, session, and callback handlers |
| GET | `/api/tickets/submit/[token]` | No (QR token) | Validate location token and return location context for submission form |
| POST | `/api/tickets/submit/[token]` | No (QR token) | Submit a new ticket with media upload; enqueues an Opened notification to the relevant technicians |
| GET | `/api/tickets` | Yes | List tickets — filtered by role (technician sees all, owner sees their locations) |
| GET | `/api/tickets/[id]` | Yes | Get ticket detail including notes, media, and approval status |
| PATCH | `/api/tickets/[id]/status` | Yes (Technician+) | Update ticket status; notifies owner/owner staff only when the ticket becomes Resolved. No notification on In Progress or On Hold transitions. |
| POST | `/api/tickets/[id]/notes` | Yes (Technician+) | Add a note to a ticket |
| POST | `/api/tickets/[id]/approval` | Yes (Technician) | Request budget approval — moves ticket to AWAITING_APPROVAL and notifies owner/owner staff |
| PATCH | `/api/tickets/[id]/approval` | Yes (Owner/Owner Staff) | Approve or decline a budget approval request; notifies the requesting technician of the decision |
| GET | `/api/locations` | Yes (Admin+) | List all locations (super-admin) or owned locations (owner) |
| POST | `/api/locations` | Yes (Super-Admin) | Create a new location and generate its QR token |
| PATCH | `/api/locations/[id]` | Yes (Super-Admin) | Update location details or regenerate QR token |
| GET | `/api/users` | Yes (Super-Admin) | List all users |
| POST | `/api/users` | Yes (Super-Admin) | Create a new technician, owner, or owner staff account |
| GET | `/api/reporting/dashboard` | Yes (Owner+) | Returns ticket stats scoped to the requester's locations |
| GET | `/api/health` | No | Health check endpoint for Uptime Kuma monitoring |

### 6.3 Authentication & Authorization

#### Auth Flow

NextAuth.js v5 handles all authentication. Technicians, owners, owner staff, and the super-admin log in via email/password (Credentials provider). Sessions are server-side (stored in PostgreSQL and optionally cached in Redis) and referenced by an opaque, signed HttpOnly cookie with a 24-hour sliding TTL. Server-side sessions allow immediate revocation on logout, role change, or account deactivation — a deactivated user is locked out at once rather than waiting for a token to expire. No authentication is required for QR code ticket submission — the location token in the URL serves as the access mechanism for that flow.

#### Authorization Model

Role-based access control (RBAC) with four roles: SUPER_ADMIN, OWNER, OWNER_STAFF, TECHNICIAN. Authorization is enforced at the service layer, not just middleware; authentication is likewise verified in the route/service layer rather than relied upon at middleware alone. Owner and owner staff data access is additionally scoped by `owner_id` at the database query level — not just the UI — to prevent cross-owner data leakage.

| Action | Super-Admin | Owner / Owner Staff | Technician | Notes |
| --- | --- | --- | --- | --- |
| View all tickets | Yes | Own locations only | Yes (by category) | |
| Update ticket status | Yes | No | Yes | |
| Add ticket notes | Yes | No | Yes | |
| Approve/decline budget | Yes | Yes | No | |
| View reporting dashboard | Yes | Own locations only | No | |
| Manage locations & QR codes | Yes | No | No | Super-admin only |
| Manage users | Yes | No | No | Super-admin only |

---

## 7. Coding Conventions

### 7.1 General

- Language: TypeScript with strict mode enabled across all packages
- Linting: ESLint with Next.js recommended config; Formatting: Prettier (config in `.prettierrc`)
- Max file length: ~300 lines. Split larger files into smaller modules.
- No comments explaining what code does — write self-documenting code. Comments for *why*.
- All environment variables validated at startup via Zod — fail fast if required vars are missing
- These conventions should be mirrored in CLAUDE.md for Claude Code sessions

### 7.2 Naming Conventions

| Thing | Convention | Example |
| --- | --- | --- |
| Files & folders | kebab-case | `ticket-service.ts`, `submit-form.tsx` |
| React components | PascalCase | `TicketCard.tsx`, `OwnerDashboard.tsx` |
| Functions / variables | camelCase | `getTicketById()`, `isLoading` |
| Constants | UPPER_SNAKE_CASE | `MAX_FILE_SIZE_MB`, `QR_TOKEN_LENGTH` |
| Types / Interfaces | PascalCase | `TicketStatus`, `ApiResponse<T>` |
| Database tables | snake_case plural | `tickets`, `ticket_notes`, `ticket_media` |
| API endpoints | kebab-case plural | `/api/tickets`, `/api/ticket-media` |
| Env variables | UPPER_SNAKE_CASE | `DATABASE_URL`, `DISCORD_WEBHOOK_URL` |

### 7.3 Patterns to Follow

- Repository pattern for all database access — no raw Prisma queries in route handlers
- Service layer for business logic — keep API route handlers thin
- Zod schemas for all external input validation (API request bodies, env vars, form data)
- Error handling: throw typed errors in services, catch and format at route handler layer
- Large media uploaded via short-lived, server-issued presigned PUT URLs to MinIO; the server enforces MIME/size limits when issuing the URL and validates the stored object afterward — avoid buffering large files through the app process
- QR tokens validated and rate-limited in middleware before reaching route handlers

### 7.4 Patterns to Avoid

- No `any` type in TypeScript — use `unknown` and narrow with Zod or type guards
- No business logic in UI components — components call hooks or server actions only
- No direct database queries in route handlers — always go through the repository layer
- No hardcoded location IDs, user IDs, or secrets anywhere in source code
- No environment-specific code in shared packages

---

## 8. Testing Strategy

| Level | Tool | What to Test | Coverage Target |
| --- | --- | --- | --- |
| Unit | Vitest | Service layer logic, QR token validation, notification dispatch, data transformations | 80% on service layer |
| Integration | Vitest + Supertest | API route handlers, Prisma DB interactions, auth flows, role-based access enforcement | All critical API routes |
| E2E | Playwright (mobile viewport) | QR scan → ticket submission, technician status update, owner approval flow, admin user creation | All happy paths |
| Component | Vitest + React Testing Library | Ticket form validation, dashboard data rendering, mobile touch interactions | Key UI components |

Testing conventions:

- E2E tests run at mobile viewport (390x844) by default — desktop is secondary
- Test files co-located with source: `ticket-service.ts` → `ticket-service.test.ts`
- E2E tests in `/tests/e2e/` with one file per user flow
- Factories/fixtures for test data — no hardcoded IDs or tokens in tests
- CI pipeline blocks merge if any test fails

---

## 9. Security

### 9.1 Security Requirements

- QR submission endpoint rate-limited per location token (sliding window) with a secondary per-IP limit; many staff at one location may share a single NAT IP, so the per-token limit is primary. Duplicate-submission suppression and a lightweight anti-bot challenge guard against floods
- QR tokens are cryptographically random (32 bytes, hex-encoded) — not sequential or guessable
- All authenticated API routes verify a valid Auth.js session in the route/service layer; middleware is a convenience filter only and must not be the sole gate (Next.js middleware auth is bypassable — see CVE-2025-29927)
- Owner data isolation enforced at the PostgreSQL query level via `owner_id` scoping
- All user input validated and sanitized via Zod before processing or persisting
- Secrets stored in environment variables only — never committed to the repository
- HTTPS enforced by Caddy in all non-local environments
- CORS configured to allow only the production domain origin
- Media uploads validated for MIME type and file size before writing to MinIO
- No PII or secrets ever written to application logs

### 9.2 Secret Management

| Secret / Credential | Storage Location | Rotation Policy |
| --- | --- | --- |
| PostgreSQL credentials | VPS `.env` file (not in repo) + GitHub Actions secrets | On compromise |
| NextAuth.js signing secret | VPS `.env` file + GitHub Actions secrets | Every 180 days |
| Gmail SMTP credentials | VPS `.env` file + GitHub Actions secrets | On compromise or Google password change |
| Discord webhook URLs | Database (per-user setting) | On demand via admin panel |
| MinIO access/secret keys | VPS `.env` file + GitHub Actions secrets | On compromise |
| SSH deploy key (GitHub Actions) | GitHub Actions secrets | Annually |

---

## 10. Observability

### 10.1 Logging

- Structured JSON logs in all non-development environments
- Log levels: ERROR, WARN, INFO, DEBUG — default INFO in production, DEBUG in development
- Every API request logged with: `request_id`, `user_id` (if authenticated), `method`, `path`, `status`, `duration_ms`
- All ticket status transitions logged with: `ticket_id`, `from_status`, `to_status`, `actor_id`, `timestamp`
- Notification job outcomes (success/failure) logged with `job_id` and target channel
- Sensitive fields (passwords, tokens, full file paths) never logged

### 10.2 Metrics & Alerting

| Metric | Alert Threshold | Owner / Runbook |
| --- | --- | --- |
| Application uptime | < 99.5% over 24h | Head of IT — check Uptime Kuma dashboard |
| API error rate (5xx) | > 2% over 5 min | Eng Lead — check Sentry for stack traces |
| Ticket submission failures | > 3 in 10 min | Eng Lead — check submission API logs |
| Notification job failure rate | > 10% over 15 min | Eng Lead — check BullMQ dead-letter queue |
| Disk usage (VPS) | > 80% capacity | Head of IT — review MinIO media storage and DB size |
| Gmail SMTP send failures / bounces | > 5% over 1h | Eng Lead — check Gmail SMTP send logs and quota usage |

---

## 11. Architecture Decision Records (ADRs)

### ADR-001: Next.js as Unified Frontend and Backend Framework

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | May 30, 2026 |
| **Context** | The system needs a mobile-first web UI and a REST API. The team is small and self-hosting on a single VPS. |
| **Decision** | Use Next.js 16.2.6 for both the frontend and API routes, deployed as a single Docker container. |
| **Rationale** | Eliminates the need to maintain separate frontend and backend services, reducing operational complexity on a self-hosted VPS. Next.js API routes are sufficient for this scale. Co-location simplifies type sharing and deployment. |
| **Trade-offs** | Less separation of concerns than a dedicated API server. If the API needs to scale independently in future, a separate service will be required. |

### ADR-002: Self-Hosted MinIO for Media Storage

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | May 30, 2026 |
| **Context** | Photo and video attachments are required for every ticket. Cloud storage (AWS S3) was considered. |
| **Decision** | Use MinIO, a self-hosted S3-compatible object store, running as a Docker container on the VPS. |
| **Rationale** | Keeps all data on-premises with no cloud storage costs or external data dependencies. MinIO's S3-compatible API means the application code can switch to AWS S3 in future with minimal changes. |
| **Trade-offs** | VPS disk space must be monitored and expanded as media accumulates. No CDN for media delivery — acceptable at current scale of 25 locations. MinIO objects must be backed up off-host; media must not exist only on the application host. |

### ADR-003: Caddy as Reverse Proxy Instead of Nginx

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | May 30, 2026 |
| **Context** | The application needs HTTPS termination and reverse proxying on the VPS. Nginx with Certbot was the default alternative. |
| **Decision** | Use Caddy as the reverse proxy. |
| **Rationale** | Caddy handles Let's Encrypt certificate provisioning and renewal automatically with zero configuration. Reduces operational overhead compared to Nginx + Certbot. Mobile-optimized HTTP/2 and HTTP/3 support out of the box. |
| **Trade-offs** | Less community documentation than Nginx. Advanced configuration is less familiar to most engineers. |

### ADR-004: BullMQ for Async Notification Dispatch

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | May 30, 2026 |
| **Context** | Ticket submission must be fast (< 2s). Discord webhook calls and Gmail SMTP sends add latency and can fail. Synchronous notification in the submission handler would degrade mobile UX. |
| **Decision** | Enqueue notification jobs in BullMQ (Redis-backed) during ticket submission. A worker handles dispatch asynchronously, running as its own process/container separate from the web server so a worker crash or heavy job does not affect request serving. |
| **Rationale** | Decouples submission response time from notification delivery. Failed notifications can be retried automatically. Dead-letter queue provides visibility into failures. |
| **Trade-offs** | Adds Redis as a required service. Notifications may be slightly delayed (seconds) after submission — acceptable per requirements. |

### ADR-005: Unauthenticated QR Submission with Signed Location Tokens

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | May 30, 2026 |
| **Context** | Store staff must be able to submit tickets without any login. The system still needs to associate each submission with the correct location and prevent abuse. |
| **Decision** | Each location gets a unique, cryptographically random QR token embedded in its QR code URL. The token is validated server-side on each submission. Rate limiting is applied per token per IP. |
| **Rationale** | Eliminates the login barrier that made QSRSoft unusable for store staff. Tokens are unguessable and can be regenerated by the super-admin if compromised. Rate limiting prevents spam submissions. |
| **Trade-offs** | Anyone who physically scans the QR code can submit a ticket. This is intentional and acceptable — store QR codes are posted in staff-only areas. Because the token is effectively a public static secret (it can be photographed), submissions are rate-limited per location, duplicate-suppressed, and protected by a lightweight anti-bot challenge; the super-admin can regenerate a token if it is abused. |

### ADR-006: Database-Backed Sessions Instead of Stateless JWT

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | May 30, 2026 |
| **Context** | Admins must be able to deactivate users, and role changes must take effect immediately. Stateless JWTs cannot be revoked server-side before they expire. |
| **Decision** | Use server-side sessions (stored in PostgreSQL, optionally cached in Redis) referenced by an opaque HttpOnly cookie, rather than stateless JWT sessions. |
| **Rationale** | Enables immediate revocation on logout, role change, or deactivation; avoids building a JWT denylist; session lookup is cheap at this scale. |
| **Trade-offs** | Adds a session-store read per authenticated request (mitigated by the Redis cache) and slightly more server state than stateless JWT. |

### ADR-007: Gmail SMTP for Email Notifications

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | May 30, 2026 |
| **Context** | Email notifications are needed for a small number of recipients (technicians, owners). The team is self-hosting and wants to avoid an additional paid third-party dependency for v1, and notification volume is low because email fires only on a few ticket events. |
| **Decision** | Use Gmail SMTP via Nodemailer for email notifications, with credentials supplied through environment variables. |
| **Rationale** | No additional vendor or cost and simple to configure with an existing Google account; sufficient for the low notification volume of v1 (email fires only on ticket Opened, Awaiting Approval, and Resolved events, plus approval decisions). |
| **Trade-offs** | Gmail enforces daily send limits and is not a dedicated transactional provider, so deliverability and bounce visibility are weaker and the account can be throttled or locked under sustained load. Outbound sends are queued and capped to stay within limits; revisit a dedicated provider (e.g., Postmark or SendGrid) if volume grows or deliverability suffers. |

### ADR-008: Presigned Uploads Instead of Server-Proxied Uploads

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | May 30, 2026 |
| **Context** | Every ticket requires a photo or video, often large, uploaded over poor mobile connections to a single shared web process. |
| **Decision** | Upload media via short-lived, server-issued presigned PUT URLs directly to MinIO. The server sets MIME and size constraints when issuing the URL and validates the object afterward. |
| **Rationale** | Keeps large transfers off the app process (memory and throughput) while preserving server-side control and validation. |
| **Trade-offs** | Slightly more complex client flow; requires a post-upload verification/finalize step. |

---

## 12. Key Commands & Runbook

### 12.1 Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local

# Start all local services (PostgreSQL, Redis, MinIO)
docker compose -f infra/docker-compose.dev.yml up -d

# Run database migrations
npx prisma migrate dev

# Seed database with locations and test users
npm run db:seed

# Start Next.js dev server
npm run dev
```

### 12.2 Testing

```bash
# Run all unit and integration tests
npm test

# Run with coverage report
npm run test:coverage

# Run E2E tests (Playwright — mobile viewport)
npm run test:e2e

# Run a specific test file
npm test -- ticket-service.test.ts
```

### 12.3 Database

```bash
# Create and apply a new migration
npx prisma migrate dev --name descriptive-migration-name

# Apply migrations in production (run on VPS after deploy)
npx prisma migrate deploy

# Open Prisma Studio (database GUI)
npx prisma studio

# Regenerate Prisma client after schema changes
npx prisma generate
```

### 12.4 Deployment

```bash
# GitHub Actions handles this automatically on push to main.
# Manual deploy (SSH into VPS):
docker compose pull
docker compose up -d
npx prisma migrate deploy   # Run if schema changed

# View running containers
docker compose ps

# View application logs
docker compose logs -f web
```

---

## 13. Open Questions & Future Work

| # | Question / Item | Priority | Notes |
| --- | --- | --- | --- |
| Q1 | What is the maximum file size for photo/video uploads? VPS disk must be sized accordingly. | High | Eng Lead + Head of IT to decide before build |
| Q2 | Should a backup approver be designated if the primary owner is unavailable for budget approvals? | High | Owner A and Owner B to confirm |
| Q3 | Should ticket history be retained indefinitely or archived/purged after a set period? Affects MinIO and DB sizing. | Medium | Head of IT to decide |
| Q4 | Offline queuing: should ticket submissions be queued locally on the mobile device if the VPS is unreachable? | Medium | Future phase consideration — not in v1 |
| Q5 | VPS specs: CPU, RAM, and disk sizing should be confirmed based on expected media volume and concurrent users. | High | Eng Lead to spec before infrastructure setup |
| Q6 | Backup strategy: scheduled PostgreSQL dumps AND MinIO object-storage (media) backups to an off-host destination, with tested restore, must be defined. Media is required evidence and must not live only on the app host. | High | Head of IT — critical before production launch |
| Q7 | Media retention period and who may view attachments (photos/videos may contain staff or customer PII)? | Medium | Head of IT — define access scope and purge policy |
| Q8 | Pin and validate Auth.js v5 (still beta) with the Credentials provider, server-side sessions, and Next.js 16 proxy.ts before build. | High | Eng Lead — verify the compatibility matrix early |

*End of Document*
