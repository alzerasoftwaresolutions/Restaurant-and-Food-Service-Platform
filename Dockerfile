# ==============================================================================
# RFSP Core Platform v1 — Multi-Stage Production & Staging Dockerfile
# ==============================================================================

# --- Stage 1: Build & Dependencies ---
FROM node:22-alpine AS dependencies

WORKDIR /app

# Copy dependency definitions
COPY package.json package-lock.json ./

# Install production dependencies cleanly
RUN npm ci --only=production && npm cache clean --force

# --- Stage 2: Production Runtime ---
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Create media uploads directory with appropriate permissions
RUN mkdir -p /app/public/uploads && chown -R node:node /app

# Copy production node_modules from dependencies stage
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules

# Copy application source code and assets
COPY --chown=node:node package.json ./
COPY --chown=node:node public/ ./public/
COPY --chown=node:node src/ ./src/

# Switch to non-root user for container security
USER node

# Expose HTTP port
EXPOSE 3000

# Container healthcheck querying the /api/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Start the application
CMD ["node", "src/server.js"]
