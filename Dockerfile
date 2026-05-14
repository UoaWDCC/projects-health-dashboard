FROM node:18-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable pnpm

# Install dependencies
FROM base AS deps
WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/github/package.json ./packages/github/

RUN pnpm install --frozen-lockfile

# Build
FROM base AS builder
WORKDIR /app

# Copy root node_modules AND workspace-specific node_modules (pnpm creates both)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/github/node_modules ./packages/github/node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma client first (schema.prisma is now available from COPY . .)
# then build the web app
RUN corepack enable pnpm && pnpm --filter @repo/db db:generate && pnpm --filter web build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# No public folder — this project has none

RUN mkdir -p apps/web/.next
RUN chown -R nextjs:nodejs apps/web/.next

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# In a pnpm monorepo, Next.js standalone traces from the monorepo root,
# so server.js lands at apps/web/server.js inside the standalone output
CMD ["node", "apps/web/server.js"]
