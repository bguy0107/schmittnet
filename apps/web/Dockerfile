FROM node:22-alpine AS base

# Install dependencies only
FROM base AS deps
WORKDIR /app
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY packages/types/package*.json ./packages/types/
COPY packages/utils/package*.json ./packages/utils/
RUN npm ci --workspace=apps/web --workspace=packages/types --workspace=packages/utils

# Build the Next.js app
FROM base AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate --schema=apps/web/prisma/schema.prisma
RUN npm run build --workspace=apps/web
RUN npx esbuild apps/web/prisma/seed.ts --platform=node --target=node22 --outfile=apps/web/prisma/seed.js

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache openssl && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/prisma ./apps/web/prisma
# Prisma CLI + engines — needed for migrate deploy and seed
COPY --from=deps /app/node_modules/prisma ./node_modules/prisma/
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma/
# Shell wrapper so __dirname resolves to node_modules/prisma/build/ where the WASM lives.
# Copying .bin/prisma as a real file (Docker follows symlinks) would set __dirname to .bin/
# and break the WASM lookup at node_modules/prisma/build/prisma_schema_build_bg.wasm.
RUN mkdir -p ./node_modules/.bin && \
    printf '#!/bin/sh\nexec node /app/node_modules/prisma/build/index.js "$@"\n' \
      > ./node_modules/.bin/prisma && \
    chmod +x ./node_modules/.bin/prisma

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
