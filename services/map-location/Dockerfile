# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM golang:1.22-alpine AS builder
WORKDIR /app

# Install git (needed for go module downloads)
RUN apk add --no-cache git

# Download modules first (cached layer)
COPY go.mod go.sum ./
RUN go mod download

# Copy source and build
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-w -s" -o /map-service ./cmd/server

# ── Stage 2: Production image ────────────────────────────────────────────────
FROM gcr.io/distroless/static-debian12
WORKDIR /app

# distroless runs as non-root by default (uid 65532)
COPY --from=builder /map-service .

EXPOSE 8010
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
    CMD ["/map-service", "-health"]

ENTRYPOINT ["/app/map-service"]
