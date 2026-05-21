FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/shared ./packages/shared
COPY services/booking ./services/booking
RUN npm ci --workspace=@tripparty/booking-service
RUN npm run build --workspace=@tripparty/booking-service

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/services/booking/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 8013
CMD ["node", "dist/server.js"]

