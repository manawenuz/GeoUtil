FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

# Dummy env vars for Next.js static page generation at build time
# These are NOT used at runtime - real values come from docker-compose environment
ENV STORAGE_BACKEND=sqlite \
    ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000 \
    NEXTAUTH_SECRET=build-placeholder \
    NEXTAUTH_URL=http://localhost:3000 \
    GOOGLE_CLIENT_ID=build-placeholder \
    GOOGLE_CLIENT_SECRET=build-placeholder \
    CRON_SECRET=build-placeholder

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Install wget for healthcheck
RUN apk add --no-cache wget

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
