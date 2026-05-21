# ── Stage 1: Install & Build ──────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
 
COPY package*.json ./
RUN npm ci --frozen-lockfile
 
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
 
# ── Stage 2: Production image ────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
 
# Copy production deps only
COPY package*.json ./
RUN npm ci --frozen-lockfile --omit=dev
 
# Copy compiled output
COPY --from=builder /app/dist ./dist
 
# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
 
EXPOSE 8011
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget -qO- http://localhost:8011/health || exit 1
 
CMD ["node", "dist/server.js"]
