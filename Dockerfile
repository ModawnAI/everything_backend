# Multi-stage Dockerfile for Payment Backend
# Optimized for production deployments with health checks and security

# =============================================
# Build Stage
# =============================================
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci --include=dev --prefer-offline --no-audit

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# =============================================
# Production Stage
# =============================================
FROM node:18-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S backend -u 1001

# Set working directory
WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    curl \
    dumb-init \
    tzdata

# Copy built application from builder stage
COPY --from=builder --chown=backend:nodejs /app/dist ./dist
COPY --from=builder --chown=backend:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=backend:nodejs /app/package*.json ./

# Create necessary directories
RUN mkdir -p logs temp uploads && \
    chown -R backend:nodejs logs temp uploads

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV TZ=Asia/Seoul

# Expose port
EXPOSE 3000

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Switch to non-root user
USER backend

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/app.js"]

# =============================================
# Development Stage (optional)
# =============================================
FROM node:18-alpine AS development

WORKDIR /app

# Install all dependencies including dev
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci --include=dev

# Copy source code
COPY . .

# Create directories
RUN mkdir -p logs temp uploads

# Expose port
EXPOSE 3000

# Health check for development
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start in development mode
CMD ["npm", "run", "dev"]

# =============================================
# Metadata
# =============================================
LABEL maintainer="ebeautything-team"
LABEL version="1.0.0"
LABEL description="Payment Backend API Server"
LABEL org.opencontainers.image.source="https://github.com/ebeautything/backend"
LABEL org.opencontainers.image.documentation="https://github.com/ebeautything/backend/blob/main/README.md"
LABEL org.opencontainers.image.licenses="MIT"

