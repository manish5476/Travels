
# ── STAGE 1: Install dependencies ─────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --frozen-lockfile

# ── STAGE 2: Build TypeScript → JavaScript ─────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── STAGE 3: Production (smallest image) ───────────────────
FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --frozen-lockfile --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

# Never run containers as root
USER node

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:8001/health || exit 1

CMD ["node", "dist/server.js"]

# ── STAGE 4: Development (hot reload) ──────────────────────
FROM node:20-alpine AS dev
WORKDIR /app
ENV NODE_ENV=development
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 8001
CMD ["npx","ts-node-dev","--respawn","--transpile-only","src/server.ts"]
