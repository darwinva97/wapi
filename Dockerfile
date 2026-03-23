# Multi-stage Dockerfile for Next.js with pnpm
FROM node:24-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY .npmrc ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Environment variables for build time
ARG DATABASE_URL
ARG BETTER_AUTH_URL
ARG BETTER_AUTH_SECRET
ENV DATABASE_URL=$DATABASE_URL
ENV BETTER_AUTH_URL=$BETTER_AUTH_URL
ENV BETTER_AUTH_SECRET=$BETTER_AUTH_SECRET
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN pnpm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Copy built artifacts
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Create directories for persistent data
RUN mkdir -p /app/whatsapp_sessions /app/public/media && \
    chown -R nextjs:nodejs /app/whatsapp_sessions /app/public/media

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
