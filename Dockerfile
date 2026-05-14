# ── Stage 1: Build the Vite frontend ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (cache layers)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# ── Stage 2: Production server ───────────────────────────────────────────────
FROM node:20-alpine AS production

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built frontend from builder
COPY --from=builder /app/dist ./dist

# Copy server and data directory
COPY server.cjs .
RUN mkdir -p /app/data && chown -R appuser:nodejs /app/data

# Switch to non-root user
USER appuser

# Expose configurable port (default 3001)
ARG PORT=3001
ENV PORT=${PORT}

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/api/healthz || exit 1

EXPOSE ${PORT}

CMD ["node", "server.cjs"]
