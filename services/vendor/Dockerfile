FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/shared ./packages/shared
COPY services/vendor ./services/vendor
RUN npm ci --workspace=@tripparty/vendor-service
RUN npm run build --workspace=@tripparty/vendor-service

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/services/vendor/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 8012
CMD ["node", "dist/server.js"]
