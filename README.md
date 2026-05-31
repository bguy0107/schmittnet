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

Copy `apps/web/.env.example` to `.env` at the repo root (for production) or `apps/web/.env.local` (for local dev) and fill in the blanks.

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Postgres credentials (also read directly by the Postgres container) |
| `REDIS_URL` | Redis connection string |
| `MINIO_ENDPOINT` | MinIO hostname (`minio` inside Docker network, `localhost` for dev) |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | MinIO root credentials |
| `MINIO_BUCKET` | Bucket name (default: `tickets`) |
| `AUTH_SECRET` | 32-byte random string — `openssl rand -hex 32` |
| `NEXTAUTH_URL` | Full public URL of the app (e.g. `https://tickets.example.com`) |
| `DOMAIN` | Hostname only, no protocol — used by Caddy for TLS (e.g. `tickets.example.com`) |
| `GMAIL_USER` | Gmail address for email notifications (optional) |
| `GMAIL_APP_PASSWORD` | Gmail app password (optional) |

---

## Deployment

Two paths are supported. Pick the one that matches your environment.

- **[Local network](#local-network-self-hosted-lan)** — runs entirely on an internal network with no public domain. Suitable when all locations share a LAN or a site-to-site VPN.
- **[VPS](#vps-public-internet)** — public server with a domain; HTTPS via Let's Encrypt, automated deploys via GitHub Actions.

---

### Local network (self-hosted LAN)

> **HTTPS and mobile camera:** Mobile browsers block camera access on plain HTTP pages. If staff will photograph issues directly from the ticket submission form, HTTPS is required. The easiest way to get HTTPS on a LAN is to point a real subdomain's A record at the host's IP and let Caddy provision a certificate automatically — skip step 4 below if you take that route. If HTTPS is not practical, staff can still attach files through the file picker rather than the camera.

#### Prerequisites

- A host machine running Ubuntu 22.04 / Debian 12 or later (a NUC, mini-PC, or any spare server works)
- Docker Engine 24+ with the Compose plugin — [install guide](https://docs.docker.com/engine/install/ubuntu/)
- 2 GB RAM minimum (4 GB recommended)
- The host reachable from all restaurant devices on the same network or VPN
- `git` installed on the host

#### 1. Clone the repository

```bash
git clone https://github.com/<your-org>/schmittnet.git /opt/schmittnet
cd /opt/schmittnet
```

#### 2. Build the Docker image

The production image must be built locally because the GitHub Actions CI/CD pipeline (which normally builds and pushes it) is only used for the VPS path.

```bash
docker build -t ghcr.io/schmittnet/schmittnet:latest \
  -f apps/web/Dockerfile .
```

This tags the image to match the name the production compose file expects by default.

#### 3. Create and configure the environment file

```bash
cp apps/web/.env.example .env
```

Edit `/opt/schmittnet/.env`. The values that must change from the example defaults:

```ini
NODE_ENV=production

# Replace with the host's LAN IP (or local hostname if using DNS)
NEXTAUTH_URL=http://192.168.1.50

# Use the Docker service name — containers communicate by service name, not localhost
DATABASE_URL=postgresql://schmittnet:<POSTGRES_PASSWORD>@postgres:5432/schmittnet
REDIS_URL=redis://redis:6379
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_USE_SSL=false

# Set strong credentials
POSTGRES_USER=schmittnet
POSTGRES_DB=schmittnet
POSTGRES_PASSWORD=<strong-password>
MINIO_ACCESS_KEY=<strong-username>
MINIO_SECRET_KEY=<strong-password>

# Generate with: openssl rand -hex 32
AUTH_SECRET=<generated-secret>

# Optional — email notifications
GMAIL_USER=your-gmail@gmail.com
GMAIL_APP_PASSWORD=your-app-password
```

#### 4. Configure Caddy for plain HTTP (skip if using a real domain with HTTPS)

The default `infra/Caddyfile` is configured for HTTPS with a public domain. For a plain HTTP LAN deployment, make two edits:

```diff
-{$DOMAIN} {
+:80 {
     reverse_proxy web:3000

     header {
-        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
         X-Content-Type-Options nosniff
```

#### 5. Start the stack

```bash
docker compose -f infra/docker-compose.yml up -d
```

Confirm all services are healthy before continuing:

```bash
docker compose -f infra/docker-compose.yml ps
```

#### 6. Create the MinIO storage bucket

```bash
docker compose -f infra/docker-compose.yml exec minio \
  sh -c 'mc alias set local http://localhost:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" \
         && mc mb --ignore-existing local/tickets'
```

#### 7. Run database migrations

```bash
docker compose -f infra/docker-compose.yml exec web \
  npx prisma migrate deploy
```

#### 8. Seed the initial accounts and locations

```bash
docker compose -f infra/docker-compose.yml exec web npm run db:seed
```

This creates the test accounts from the [Seeded test accounts](#seeded-test-accounts) table above, two owner groups, and six sample locations. Log in as `admin@schmittnet.local` / `Admin1234!` to create real users and locations via the admin panel, then deactivate or change the passwords for all seeded test accounts before going live.

#### 9. Verify

Open `http://<host-ip>` in a browser — you should see the login page.

#### 10. Auto-start on boot (optional but recommended)

```bash
sudo tee /etc/systemd/system/schmittnet.service << 'EOF'
[Unit]
Description=SchmittNet
After=docker.service
Requires=docker.service

[Service]
WorkingDirectory=/opt/schmittnet
ExecStart=docker compose -f infra/docker-compose.yml up
ExecStop=docker compose -f infra/docker-compose.yml down
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now schmittnet
```

#### Updating (local network)

Pull the latest code, rebuild the image, and restart the stack:

```bash
cd /opt/schmittnet
git pull
docker build -t ghcr.io/schmittnet/schmittnet:latest -f apps/web/Dockerfile .
docker compose -f infra/docker-compose.yml up -d
docker compose -f infra/docker-compose.yml exec web npx prisma migrate deploy
```

---

### VPS (public internet)

Caddy automatically provisions a TLS certificate for the domain. GitHub Actions builds the Docker image on every merge to `main`, pushes it to GitHub Container Registry, then SSHs into the VPS to deploy.

#### Prerequisites

- A VPS running Ubuntu 22.04+ (2 vCPU / 2 GB RAM minimum)
- A domain or subdomain you control (e.g. `tickets.yourcompany.com`)
- Ports 22, 80, and 443 open in the VPS firewall
- Docker Engine 24+ with the Compose plugin installed on the VPS
- A GitHub repository with Actions enabled

#### 1. Provision the server

```bash
# SSH into the VPS, then install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker   # apply group change without logging out
```

#### 2. Configure DNS

Create an A record pointing to the VPS IP:

```
tickets.yourcompany.com   A   <VPS-IP>
```

Wait for DNS to propagate before bringing up Caddy — it must pass an ACME HTTP challenge to provision the certificate.

#### 3. Clone the repository on the VPS

```bash
git clone https://github.com/<your-org>/schmittnet.git /opt/schmittnet
```

#### 4. Create the environment file

```bash
cp /opt/schmittnet/apps/web/.env.example /opt/schmittnet/.env
```

Edit `/opt/schmittnet/.env`:

```ini
NODE_ENV=production
NEXTAUTH_URL=https://tickets.yourcompany.com
DOMAIN=tickets.yourcompany.com

# Docker service names — do not use localhost
DATABASE_URL=postgresql://schmittnet:<POSTGRES_PASSWORD>@postgres:5432/schmittnet
REDIS_URL=redis://redis:6379
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_USE_SSL=false

POSTGRES_USER=schmittnet
POSTGRES_DB=schmittnet
POSTGRES_PASSWORD=<strong-password>
MINIO_ACCESS_KEY=<strong-username>
MINIO_SECRET_KEY=<strong-password>
MINIO_BUCKET=tickets

# Generate with: openssl rand -hex 32
AUTH_SECRET=<generated-secret>

# Optional — email notifications
GMAIL_USER=your-gmail@gmail.com
GMAIL_APP_PASSWORD=your-app-password
```

#### 5. Configure GitHub Actions secrets

In your GitHub repo → **Settings → Secrets and variables → Actions**, add:

| Secret | Value |
|---|---|
| `VPS_HOST` | VPS IP address or hostname |
| `VPS_USER` | SSH username on the VPS |
| `VPS_SSH_KEY` | Private SSH key — paste the full contents including `-----BEGIN` / `-----END` lines |

Also ensure the repository has write permissions for GitHub Container Registry: **Settings → Actions → General → Workflow permissions → Read and write permissions**.

#### 6. Trigger the first build and deploy

The deploy workflow runs automatically after CI passes on a push to `main`. Trigger it with an empty commit if the branch is already up to date:

```bash
git commit --allow-empty -m "chore: trigger first deploy"
git push origin main
```

GitHub Actions will:
1. Run tests and type-checking
2. Build the Docker image and push it to GHCR tagged with the commit SHA
3. SSH to the VPS, pull the new image, restart containers, and run `prisma migrate deploy`
4. Hit `/api/health` to verify the deployment succeeded

Monitor progress in the **Actions** tab of your repository.

#### 7. Bootstrap the database

After the first successful deploy, SSH into the VPS and run:

```bash
# Seed test accounts, owner groups, and sample locations
docker compose -f /opt/schmittnet/infra/docker-compose.yml exec web \
  npm run db:seed

# Create the MinIO storage bucket
docker compose -f /opt/schmittnet/infra/docker-compose.yml exec minio \
  sh -c 'mc alias set local http://localhost:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" \
         && mc mb --ignore-existing local/tickets'
```

#### 8. Verify

Browse to `https://tickets.yourcompany.com` — Caddy provisions the TLS certificate on first request (takes a few seconds). Sign in with `admin@schmittnet.local` / `Admin1234!`, create your real users and locations, then deactivate or change the passwords for all seeded test accounts.

#### Subsequent deploys

Push to `main` — GitHub Actions handles everything automatically.
